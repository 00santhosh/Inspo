import { Skia, useFonts, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

export const FONT_FAMILY = 'Inter';

type FontSource = Parameters<typeof useFonts>[0][string][number];

// On web, Metro turns a font require() into a URL string, which Skia only accepts as { uri }.
const asset = (m: unknown) => (typeof m === 'string' ? { uri: m } : m) as FontSource;

const INTER = [
  asset(require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf')),
  asset(require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf')),
  asset(require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf')),
];

/** Inter for text drawn on the canvas. Skia needs the font files on every platform. */
export function useCanvasFonts() {
  return useFonts({ [FONT_FAMILY]: INTER });
}

// Decoded images, shared across renders and filter changes so nothing is fetched twice.
// Signed storage URLs carry a token that changes every time they are re-signed, so images
// are keyed by the URL without its query string.
const cache = new Map<string, SkImage>();
const inflight = new Set<string>();

export const imageKey = (url: string) => url.split('?')[0];

/**
 * Loads remote images into Skia. Returns the ones that are ready, keyed by URL, and a
 * version that changes whenever more arrive.
 */
export function useSkiaImages(urls: string[]) {
  const [version, setVersion] = useState(0);
  const key = urls.join('|');

  useEffect(() => {
    let cancelled = false;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    // Re-render in small batches as images arrive, not once per image.
    const scheduleFlush = () => {
      if (flushTimer || cancelled) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        if (!cancelled) setVersion((v) => v + 1);
      }, 60);
    };
    for (const url of new Set(key.split('|'))) {
      const id = url && imageKey(url);
      if (!url || cache.has(id) || inflight.has(id)) continue;
      inflight.add(id);
      Skia.Data.fromURI(url)
        .then((data) => {
          const image = Skia.Image.MakeImageFromEncoded(data);
          if (image) cache.set(id, image);
        })
        .catch(() => {})
        .finally(() => {
          inflight.delete(id);
          scheduleFlush();
        });
    }
    return () => {
      cancelled = true;
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [key]);

  return { images: cache, version };
}
