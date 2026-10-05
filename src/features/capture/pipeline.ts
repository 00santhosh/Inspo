import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { readBlob } from '@/features/capture/blob';
import { videoThumbnail } from '@/features/capture/video-thumbnail';
import { hostOf } from '@/lib/format';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import type { ItemRow } from '@/lib/types';

/** Largest file the app will upload. Supabase's free plan allows 50 MB per file; raise this on a paid plan. */
export const MAX_UPLOAD_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
/** Long edge of the stored photo, and width of the canvas thumbnail. */
const MAX_EDGE = 2400;
const THUMB_WIDTH = 480;
export const MAX_NOTE_CHARS = 20000;
export const MAX_VOICE_SECONDS = 10 * 60;

/** An error whose message is fit to show to the user as it is. */
export class CaptureError extends Error {}

type Fields = Partial<Omit<ItemRow, 'id' | 'kind' | 'user_id' | 'created_at' | 'updated_at'>>;
export type Built = { kind: ItemRow['kind']; fields: Fields; note?: string };
/** Records each file as it is uploaded, so a failed save can remove them again. */
type Track = (path: string) => void;

function client() {
  if (!supabase) throw new CaptureError('The app isn’t connected to a server yet.');
  return supabase;
}

/** Turns anything thrown while saving into a sentence for the user. */
export function messageOf(e: unknown): string {
  if (e instanceof CaptureError) return e.message;
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/exceeded the maximum allowed size|payload too large|entity too large/i.test(text)) {
    return `That file is too large. The limit is ${MAX_UPLOAD_MB} MB.`;
  }
  if (/mime type .* not supported|invalid mime/i.test(text)) return 'That file type isn’t supported.';
  if (/row-level security|not authorized|jwt/i.test(text)) return 'You’re signed out. Sign in again and retry.';
  if (/failed to fetch|network request failed|load failed/i.test(text)) return 'Can’t reach the server. Check your connection.';
  return text || 'Something went wrong.';
}

async function upload(userId: string, itemId: string, name: string, uri: string, contentType: string, track: Track) {
  const body = await readBlob(uri);
  if (body.size > MAX_UPLOAD_BYTES) {
    throw new CaptureError(`That file is ${Math.round(body.size / 1048576)} MB. The limit is ${MAX_UPLOAD_MB} MB.`);
  }
  const path = `${userId}/${itemId}/${name}`;
  const { error } = await client().storage.from(MEDIA_BUCKET).upload(path, body, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  track(path);
  return path;
}

/**
 * Builds an item (uploading its files first) and saves its row. If anything fails the
 * uploaded files are removed, so nothing is left behind.
 */
export async function createItem(
  userId: string,
  build: (id: string, track: Track) => Promise<Built>,
): Promise<{ row: ItemRow; note?: string }> {
  const id = randomUUID();
  const uploaded: string[] = [];
  try {
    const built = await build(id, (p) => uploaded.push(p));
    const { data, error } = await client()
      .from('items')
      .insert({ id, kind: built.kind, ...built.fields })
      .select('*')
      .single();
    if (error) throw error;
    return { row: data as ItemRow, note: built.note };
  } catch (e) {
    if (uploaded.length) await client().storage.from(MEDIA_BUCKET).remove(uploaded).catch(() => {});
    throw e;
  }
}

// ---- Image ------------------------------------------------------------------------------

export const imageBuilder =
  (userId: string) =>
  async (asset: ImagePickerAsset, id: string, track: Track): Promise<Built> => {
    const edit = ImageManipulator.manipulate(asset.uri);
    const long = Math.max(asset.width, asset.height);
    // Resize only when too big. Re-encoding as JPEG also fixes rotation and converts HEIC.
    if (long > MAX_EDGE) edit.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    const main = await (await edit.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    const small = ImageManipulator.manipulate(main.uri).resize({ width: Math.min(THUMB_WIDTH, main.width) });
    const thumb = await (await small.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

    const storage_path = await upload(userId, id, 'image.jpg', main.uri, 'image/jpeg', track);
    const thumb_path = await upload(userId, id, 'thumb.jpg', thumb.uri, 'image/jpeg', track);
    return { kind: 'image', fields: { storage_path, thumb_path, width: main.width, height: main.height } };
  };

// ---- Video ------------------------------------------------------------------------------

export const videoBuilder =
  (userId: string) =>
  async (asset: ImagePickerAsset, id: string, track: Track): Promise<Built> => {
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
      throw new CaptureError(`That video is ${Math.round(asset.fileSize / 1048576)} MB. The limit is ${MAX_UPLOAD_MB} MB.`);
    }
    const mime = asset.mimeType && asset.mimeType.startsWith('video/') ? asset.mimeType : 'video/mp4';
    const ext = mime.includes('quicktime') ? 'mov' : (mime.split('/')[1] ?? 'mp4').replace(/[^a-z0-9]/gi, '') || 'mp4';
    const storage_path = await upload(userId, id, `video.${ext}`, asset.uri, mime, track);

    // The thumbnail is a nicety: the video is saved even without one.
    const frame = await videoThumbnail(asset.uri);
    const thumb_path = frame ? await upload(userId, id, 'thumb.jpg', frame.uri, 'image/jpeg', track).catch(() => null) : null;

    const durationMs = asset.duration ? Math.round(asset.duration) : (frame?.durationMs ?? null);
    return {
      kind: 'video',
      fields: {
        storage_path,
        thumb_path,
        width: asset.width || frame?.width || null,
        height: asset.height || frame?.height || null,
        duration_ms: durationMs,
      },
      note: thumb_path ? undefined : 'Saved without a preview image.',
    };
  };

// ---- Voice note -------------------------------------------------------------------------

export const voiceBuilder =
  (userId: string, voice: { uri: string; durationMs: number; title?: string }) =>
  async (id: string, track: Track): Promise<Built> => {
    const blob = await readBlob(voice.uri);
    // Browsers record WebM (Safari: MP4); iOS and Android record M4A.
    const type = Platform.OS === 'web' ? blob.type || 'audio/webm' : 'audio/mp4';
    const contentType = type.split(';')[0];
    const ext = contentType.includes('mp4') ? 'm4a' : contentType.includes('ogg') ? 'ogg' : 'webm';
    const storage_path = await upload(userId, id, `audio.${ext}`, voice.uri, contentType, track);
    return {
      kind: 'voice',
      fields: { storage_path, duration_ms: Math.round(voice.durationMs), title: voice.title?.trim() || null },
    };
  };

// ---- Note -------------------------------------------------------------------------------

export function noteBuilder(note: { title?: string; body: string }) {
  return async (): Promise<Built> => {
    const body = note.body.trim();
    if (!body) throw new CaptureError('Write something first.');
    if (body.length > MAX_NOTE_CHARS) throw new CaptureError(`Notes can be up to ${MAX_NOTE_CHARS.toLocaleString()} characters.`);
    return { kind: 'note', fields: { body, title: note.title?.trim() || null } };
  };
}

// ---- Link -------------------------------------------------------------------------------

/** "example.com/page" becomes "https://example.com/page"; anything that isn't a web address throws. */
export function normalizeUrl(raw: string): string {
  const text = raw.trim();
  if (!text) throw new CaptureError('Paste a link first.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new CaptureError('That doesn’t look like a web address.');
  }
  if (!/^https?:$/.test(url.protocol)) throw new CaptureError('Only http and https links can be saved.');
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') throw new CaptureError('That doesn’t look like a web address.');
  return url.href;
}

type Preview = { url?: string; title?: string | null; description?: string | null; siteName?: string | null; thumbPath?: string | null };

export function linkBuilder(raw: string) {
  return async (id: string, track: Track): Promise<Built> => {
    const url = normalizeUrl(raw);
    // The preview (title, description, picture) comes from an Edge Function, because
    // browsers can't read other sites' pages. It is optional: without it the link is
    // still saved, showing just its address.
    let preview: Preview | null = null;
    try {
      const { data, error } = await client().functions.invoke<Preview>('link-preview', { body: { url, itemId: id } });
      if (error) throw error;
      preview = data;
    } catch {
      preview = null;
    }
    if (preview?.thumbPath) track(preview.thumbPath);
    const host = hostOf(url);
    return {
      kind: 'link',
      fields: {
        url: preview?.url ?? url,
        link_title: preview?.title || host,
        link_description: preview?.description ?? null,
        link_site_name: preview?.siteName || host,
        thumb_path: preview?.thumbPath ?? null,
      },
      note: preview ? undefined : 'Saved without a preview.',
    };
  };
}
