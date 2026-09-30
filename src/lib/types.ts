export type ItemKind = 'image' | 'video' | 'link' | 'note' | 'voice';

/** An item as the UI sees it: storage paths already resolved to URLs. */
export type Item = {
  id: string;
  kind: ItemKind;
  createdAt: string;
  title?: string | null;
  /** Note text, or a voice-note transcript. */
  body?: string | null;
  /** Full-size image, the video file, or the audio file. */
  mediaUrl?: string | null;
  /** Poster/thumbnail for images and videos. */
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  link?: {
    url: string;
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    siteName?: string | null;
  } | null;
  tags?: string[];
};

/** A row in public.items (see supabase/migrations). */
export type ItemRow = {
  id: string;
  user_id: string;
  kind: ItemKind;
  title: string | null;
  body: string | null;
  storage_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image_url: string | null;
  link_site_name: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};
