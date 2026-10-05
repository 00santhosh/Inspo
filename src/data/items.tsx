import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { demoItems } from '@/data/demo';
import { useAuth } from '@/lib/auth';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import type { Item, ItemRow } from '@/lib/types';

// Image links are signed (they stop working when they expire), so they are re-signed
// before that happens: on coming back to the app, and on a timer while it stays open.
const SIGNED_URL_TTL = 12 * 60 * 60;
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 15 * 60 * 1000;
const PAGE_LIMIT = 500;
const SIGN_BATCH = 200;

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (!supabase || !paths.length) return signed;
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += SIGN_BATCH) {
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(unique.slice(i, i + SIGN_BATCH), SIGNED_URL_TTL);
    if (error) throw error;
    for (const s of data) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  return signed;
}

function rowToItem(r: ItemRow, signed: Map<string, string>): Item {
  const main = r.storage_path ? (signed.get(r.storage_path) ?? null) : null;
  const thumb = r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null;
  return {
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    title: r.title,
    body: r.body,
    mediaUrl: main,
    // Images fall back to the full-size file when there is no thumbnail; videos must not
    // (the file is the video itself).
    thumbUrl: thumb ?? (r.kind === 'image' ? main : null),
    storagePath: r.storage_path,
    thumbPath: r.thumb_path,
    width: r.width,
    height: r.height,
    durationMs: r.duration_ms,
    link: r.url
      ? {
          url: r.url,
          title: r.link_title,
          description: r.link_description,
          imageUrl: thumb ?? r.link_image_url,
          siteName: r.link_site_name,
        }
      : null,
    tags: r.tags,
  };
}

async function rowsToItems(rows: ItemRow[]): Promise<Item[]> {
  const paths = rows.flatMap((r) => [r.storage_path, r.thumb_path]).filter((p): p is string => !!p);
  const signed = await signPaths(paths);
  return rows.map((r) => rowToItem(r, signed));
}

function describeError(e: unknown): string {
  const message = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/failed to fetch|network request failed|load failed/i.test(message)) {
    return 'Can’t reach the server. Check your connection.';
  }
  if (/relation .* does not exist|schema cache/i.test(message)) {
    return 'The database isn’t set up yet. Run the migration in supabase/migrations.';
  }
  return message;
}

type ItemsState = {
  items: Item[];
  source: 'demo' | 'supabase';
  loading: boolean;
  error: string | null;
  /** Reload everything from the server. */
  refresh: () => Promise<void>;
  /** Show a row that was just saved, without waiting for a reload. */
  addRow: (row: ItemRow) => Promise<Item>;
  /** Delete an item and its files. Resolves to an error message, or null on success. */
  remove: (item: Item) => Promise<string | null>;
};

const ItemsContext = createContext<ItemsState>({
  items: [],
  source: 'demo',
  loading: false,
  error: null,
  refresh: async () => {},
  addRow: async () => {
    throw new Error('Items are not available');
  },
  remove: async () => 'Items are not available',
});

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { user, demo } = useAuth();
  const userId = user?.id ?? null;
  const useDemo = demo || !supabase;
  const [state, setState] = useState<{ items: Item[]; loading: boolean; error: string | null }>({
    items: [],
    loading: true,
    error: null,
  });
  const signedAt = useRef(0);
  const request = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const client = supabase;
      if (!client || !userId) return;
      const mine = ++request.current;
      if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { data, error } = await client
          .from('items')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_LIMIT)
          .returns<ItemRow[]>();
        if (error) throw error;
        const items = await rowsToItems(data ?? []);
        if (mine !== request.current) return;
        signedAt.current = Date.now();
        setState({ items, loading: false, error: null });
      } catch (e) {
        if (mine !== request.current) return;
        // A failed quiet refresh keeps what is on screen.
        setState((s) => ({ ...s, loading: false, error: quiet ? s.error : describeError(e) }));
      }
    },
    [userId],
  );

  // Load when the user changes; clear when they sign out.
  useEffect(() => {
    request.current++;
    if (!userId) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    setState({ items: [], loading: true, error: null });
    load();
  }, [userId, load]);

  // Re-sign image links before they expire.
  useEffect(() => {
    if (!userId) return;
    const check = () => {
      if (Date.now() - signedAt.current > REFRESH_AFTER_MS) load(true);
    };
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, load]);

  const refresh = useCallback(() => load(), [load]);

  const addRow = useCallback(async (row: ItemRow) => {
    const [item] = await rowsToItems([row]);
    setState((s) => ({ ...s, items: [item, ...s.items.filter((i) => i.id !== item.id)] }));
    return item;
  }, []);

  const remove = useCallback(async (item: Item) => {
    const client = supabase;
    if (!client) return 'Not connected.';
    const { error } = await client.from('items').delete().eq('id', item.id);
    if (error) return describeError(error);
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
    // Best effort: the item is already gone from the user's canvas.
    const paths = [item.storagePath, item.thumbPath].filter((p): p is string => !!p);
    if (paths.length) await client.storage.from(MEDIA_BUCKET).remove(paths);
    return null;
  }, []);

  const value = useMemo<ItemsState>(
    () =>
      useDemo
        ? { items: demoItems, source: 'demo', loading: false, error: null, refresh: async () => {}, addRow, remove }
        : { items: state.items, source: 'supabase', loading: state.loading, error: state.error, refresh, addRow, remove },
    [useDemo, state, refresh, addRow, remove],
  );

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  return useContext(ItemsContext);
}

export function useItem(id: string | undefined) {
  const { items } = useItems();
  return items.find((i) => i.id === id);
}
