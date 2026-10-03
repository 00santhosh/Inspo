import type { Item } from '@/lib/types';

export function formatDuration(ms: number | null | undefined) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** One-line description of an item: its type plus a title, duration or date. */
export function describeItem(item: Item): string {
  const date = new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  switch (item.kind) {
    case 'image':
      return [item.title ?? 'Image', date].join(' · ');
    case 'video':
      return ['Video', item.title, formatDuration(item.durationMs)].filter(Boolean).join(' · ');
    case 'link':
      return item.link?.siteName ?? item.link?.title ?? 'Link';
    case 'note':
      return ['Note', date].join(' · ');
    case 'voice':
      return ['Voice', item.title, formatDuration(item.durationMs)].filter(Boolean).join(' · ');
  }
}
