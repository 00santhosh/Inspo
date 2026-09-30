import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Item } from '@/lib/types';
import { backdrop, colors, fonts, radius, shadow } from '@/theme/tokens';

export function formatDuration(ms: number | null | undefined) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

type Props = {
  item: Item;
  width: number;
  height: number;
  /** Scale for everything inside the tile (1 on the canvas, the zoom factor in the lens). */
  k?: number;
  /** Rendered over the poster, e.g. the lens's autoplaying video. */
  overlay?: ReactNode;
};

export const Tile = memo(function Tile({ item, width, height, k = 1, overlay }: Props) {
  return (
    <View style={[styles.tile, { width, height, borderRadius: radius.tile * k }]}>
      <View style={[StyleSheet.absoluteFill, styles.edge, { borderRadius: radius.tile * k, overflow: 'hidden' }]}>
        <TileBody item={item} k={k} />
        {overlay}
        {item.kind === 'video' && <VideoBadge k={k} durationMs={item.durationMs} />}
      </View>
    </View>
  );
});

function TileBody({ item, k }: { item: Item; k: number }) {
  switch (item.kind) {
    case 'image':
    case 'video':
      return (
        <Image
          source={{ uri: item.thumbUrl ?? item.mediaUrl ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={item.id}
        />
      );
    case 'link':
      return (
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          {item.link?.imageUrl ? (
            <Image source={{ uri: item.link.imageUrl }} style={{ flex: 1.1 }} contentFit="cover" />
          ) : null}
          <View style={{ padding: 6 * k, gap: 2 * k, flex: 1 }}>
            <Text numberOfLines={2} style={[styles.linkTitle, { fontSize: 9.5 * k, lineHeight: 12 * k }]}>
              {item.link?.title ?? item.link?.url}
            </Text>
            <Text numberOfLines={1} style={[styles.meta, { fontSize: 8 * k }]}>
              {item.link?.siteName ?? (item.link ? hostOf(item.link.url) : '')}
            </Text>
          </View>
        </View>
      );
    case 'note':
      return (
        <View style={{ flex: 1, backgroundColor: colors.surfaceRaised, padding: 8 * k }}>
          <Text numberOfLines={7} style={[styles.note, { fontSize: 9.5 * k, lineHeight: 13 * k }]}>
            {item.body}
          </Text>
        </View>
      );
    case 'voice':
      return (
        <View style={{ flex: 1, backgroundColor: colors.surfaceRaised, padding: 8 * k, justifyContent: 'space-between' }}>
          <Waveform seed={item.id} k={k} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text numberOfLines={1} style={[styles.linkTitle, { fontSize: 8.5 * k, flex: 1 }]}>
              {item.title ?? 'Voice note'}
            </Text>
            <Text style={[styles.meta, { fontSize: 8 * k }]}>{formatDuration(item.durationMs)}</Text>
          </View>
        </View>
      );
  }
}

/** Stable pseudo-random bar heights (0.25–1) for a placeholder waveform. */
function barHeights(seed: string, count: number): number[] {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(0.25 + ((h >>> 16) % 100) / 133);
  }
  return out;
}

function Waveform({ seed, k }: { seed: string; k: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 * k, height: 22 * k }}>
      {barHeights(seed, 14).map((v, i) => {
        return (
          <View
            key={i}
            style={{ width: 2.5 * k, height: 22 * k * v, borderRadius: 2 * k, backgroundColor: colors.voiceAccent }}
          />
        );
      })}
    </View>
  );
}

function VideoBadge({ k, durationMs }: { k: number; durationMs?: number | null }) {
  return (
    <View style={[styles.badge, { right: 5 * k, top: 5 * k, paddingHorizontal: 6 * k, height: 16 * k, gap: 3 * k }]}>
      <Svg width={6 * k} height={7 * k} viewBox="0 0 6 7">
        <Path d="M0 0.6v5.8c0 .45.5.72.88.47l4.6-2.9a.55.55 0 0 0 0-.94L.88.13C.5-.12 0 .15 0 .6z" fill="#fff" />
      </Svg>
      {durationMs ? <Text style={[styles.badgeText, { fontSize: 8 * k }]}>{formatDuration(durationMs)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    boxShadow: shadow.tile,
  },
  // A faint lit edge so dark cards separate from the dark canvas.
  edge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.08)' },
  linkTitle: { fontFamily: fonts.sans, fontWeight: '600', color: colors.text },
  meta: { fontFamily: fonts.sans, color: colors.textSecondary },
  note: { fontFamily: fonts.sans, color: colors.noteText },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.glassOnMedia,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...backdrop(10),
  },
  badgeText: { fontFamily: fonts.sans, color: '#fff', fontWeight: '600', fontVariant: ['tabular-nums'] },
});
