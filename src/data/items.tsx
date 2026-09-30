import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { demoItems } from '@/data/demo';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import type { Item, ItemRow } from '@/lib/types';

type ItemsState = { items: Item[]; source: 'demo' | 'supabase'; loading: boolean; error: string | null };

const ItemsContext = createContext<ItemsState>({ items: [], source: 'demo', loading: false, error: null });

const SIGNED_URL_TTL = 60 * 60;

async function resolveRows(rows: ItemRow[]): Promise<Item[]> {
  if (!supabase) return [];
  const paths = rows.flatMap((r) => [r.storage_path, r.thumb_path]).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) throw error;
    for (const s of data) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    title: r.title,
    body: r.body,
    mediaUrl: r.storage_path ? signed.get(r.storage_path) : null,
    thumbUrl: r.thumb_path ? signed.get(r.thumb_path) : r.storage_path ? signed.get(r.storage_path) : null,
    width: r.width,
    height: r.height,
    durationMs: r.duration_ms,
    link: r.url
      ? {
          url: r.url,
          title: r.link_title,
          description: r.link_description,
          imageUrl: r.link_image_url,
          siteName: r.link_site_name,
        }
      : null,
    tags: r.tags,
  }));
}

export function ItemsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ItemsState>(() =>
    supabase
      ? { items: [], source: 'supabase', loading: true, error: null }
      : { items: demoItems, source: 'demo', loading: false, error: null },
  );

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    async function load() {
      const { data: session } = await client!.auth.getSession();
      if (!session.session) {
        // No sign-in flow yet: show the demo canvas rather than an empty screen.
        if (!cancelled) setState({ items: demoItems, source: 'demo', loading: false, error: null });
        return;
      }
      const { data, error } = await client!
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<ItemRow[]>();
      if (error) throw error;
      const items = await resolveRows(data ?? []);
      if (!cancelled) setState({ items, source: 'supabase', loading: false, error: null });
    }

    load().catch((e: unknown) => {
      if (!cancelled) setState({ items: demoItems, source: 'demo', loading: false, error: String(e) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ItemsContext.Provider value={state}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  return useContext(ItemsContext);
}

export function useItem(id: string | undefined) {
  const { items } = useItems();
  return items.find((i) => i.id === id);
}
