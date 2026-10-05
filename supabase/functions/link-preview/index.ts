// Fetches a page's title, description and preview image for bookmark cards, and stores
// the preview image in the caller's own folder of the "media" bucket.
//
// It runs server-side because browsers block reading other sites' HTML (CORS), and the
// image is copied into storage because the canvas can't draw images from other sites
// (same CORS rule) and they may disappear or block hotlinking.
//
// JWT verification is on (supabase/config.toml), so only signed-in users can call it.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PAGE_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Formats the canvas can decode.
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Refuse obvious internal targets. Not a complete SSRF guard: DNS can still point at private IPs. */
function isAllowed(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
  if (host.startsWith('[') || host === '::1') return false;
  return true;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function meta(html: string, names: string[]) {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
      'i',
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    if (v) return decode(v);
  }
  return null;
}

async function readCapped(res: Response, limit: number) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total <= limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  if (total > limit) throw new Error('too large');
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.length;
  }
  return buf;
}

const get = (url: URL, accept: string) =>
  fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InspoCanvasBot/1.0; +link-preview)', Accept: accept },
  });

/** Copies the page's preview image into storage. Returns its path, or null if it can't be used. */
async function storeImage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  itemId: string,
  imageUrl: URL,
): Promise<string | null> {
  if (!isAllowed(imageUrl)) return null;
  const res = await get(imageUrl, 'image/*');
  if (!res.ok || !isAllowed(new URL(res.url || imageUrl.href))) {
    await res.body?.cancel();
    return null;
  }
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) {
    await res.body?.cancel();
    return null;
  }
  const bytes = await readCapped(res, MAX_IMAGE_BYTES);
  const path = `${userId}/${itemId}/thumb.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, bytes, { contentType: type, upsert: true });
  return error ? null : path;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let target: URL;
  let itemId: string | null = null;
  try {
    const body = await req.json();
    target = new URL(String(body.url));
    if (body.itemId && UUID.test(String(body.itemId))) itemId = String(body.itemId);
  } catch {
    return json({ error: 'Body must be {"url": "https://...", "itemId": "<uuid>"}' }, 400);
  }
  if (!isAllowed(target)) return json({ error: 'URL not allowed' }, 400);

  try {
    const res = await get(target, 'text/html,application/xhtml+xml');
    const finalUrl = new URL(res.url || target.href);
    if (!isAllowed(finalUrl)) return json({ error: 'URL not allowed' }, 400);

    const type = res.headers.get('content-type') ?? '';
    let html = '';
    let imageUrl: URL | null = null;
    if (type.startsWith('image/')) {
      // The link is itself a picture.
      await res.body?.cancel();
      imageUrl = finalUrl;
    } else {
      const bytes = await readCapped(res, MAX_PAGE_BYTES).catch(() => new Uint8Array());
      html = new TextDecoder().decode(bytes);
      const image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
      try {
        imageUrl = image ? new URL(image, finalUrl) : null;
      } catch {
        imageUrl = null;
      }
    }

    const docTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
    const title = meta(html, ['og:title', 'twitter:title']) ?? docTitle;

    // Store the picture in the caller's folder, as the caller (so storage rules apply).
    let thumbPath: string | null = null;
    const authorization = req.headers.get('Authorization');
    if (imageUrl && itemId && authorization) {
      try {
        const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
        const key = keys['default'] ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', key, {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false },
        });
        const { data } = await supabase.auth.getUser();
        if (data.user) thumbPath = await storeImage(supabase, data.user.id, itemId, imageUrl);
      } catch {
        thumbPath = null;
      }
    }

    return json({
      url: finalUrl.href,
      title: title ? decode(title) : null,
      description: meta(html, ['og:description', 'twitter:description', 'description']),
      siteName: meta(html, ['og:site_name']) ?? finalUrl.hostname.replace(/^www\./, ''),
      thumbPath,
    });
  } catch (e) {
    return json({ error: `Could not fetch page: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
});
