import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import type { Rect } from '@/features/bulge/bulge-math';
import { formatDuration, Tile } from '@/features/canvas/tile';
import type { Item } from '@/lib/types';
import { backdrop, colors, fonts, radius, shadow } from '@/theme/tokens';

export type HeldItem = {
  item: Item;
  /** Final on-screen size of the held tile; it is rendered at this size so it stays sharp. */
  width: number;
  height: number;
  /** Final size over the tile's normal size; scales its text and badges to match. */
  k: number;
};

type Props = {
  held: HeldItem;
  /** The held tile's current rect on screen (container coordinates), and the bulge strength. */
  rect: SharedValue<Rect>;
  strength: SharedValue<number>;
};

/**
 * The held tile at the centre of the bulge. Starts exactly over the tile on the canvas
 * and grows to full size above the finger, so the inflation reads as one continuous move.
 */
export function BulgeFocus({ held, rect, strength }: Props) {
  const { item, width, height, k } = held;

  const frame = useAnimatedStyle(() => {
    const r = rect.get();
    return {
      opacity: strength.get() > 0.001 ? 1 : 0,
      transform: [{ translateX: r.x }, { translateY: r.y }, { scale: r.w / width }],
    };
  });
  const caption = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (strength.get() - 0.6) / 0.4)) }));

  return (
    <Animated.View style={[styles.frame, { width, height, borderRadius: radius.tile * k }, frame]}>
      <Tile
        item={item}
        width={width}
        height={height}
        k={k}
        overlay={item.kind === 'video' && item.mediaUrl ? <FocusVideo uri={item.mediaUrl} /> : null}
      />
      <View style={[StyleSheet.absoluteFill, styles.edge, { borderRadius: radius.tile * k }]} />
      <Animated.View style={[styles.caption, caption]}>
        <Icon name={item.kind} size={14} strokeWidth={2} />
        <Text numberOfLines={1} style={styles.captionText}>
          {describe(item)}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function describe(item: Item): string {
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

/** Muted, looping autoplay for a held video. */
const FocusVideo = memo(function FocusVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
  });
  // Start after VideoView has attached: on web, play() only affects mounted <video> elements.
  useEffect(() => {
    player.play();
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
});

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: 'top left',
    boxShadow: shadow.lens,
    pointerEvents: 'none',
  },
  edge: { borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.85)' },
  caption: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.glassOnMedia,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...backdrop(12),
  },
  captionText: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, fontWeight: '600', color: colors.text },
});
