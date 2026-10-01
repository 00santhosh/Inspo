import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/icons';
import { DotGrid } from '@/features/canvas/dot-grid';
import type { TileRect } from '@/features/canvas/layout';
import { formatDuration, Tile } from '@/features/canvas/tile';
import type { Item } from '@/lib/types';
import { backdrop, colors, fonts, inflate as tokens, shadow } from '@/theme/tokens';

export type InflateSession = {
  /** Tiles near the viewport when the bubble opened; only these are drawn inside it. */
  tiles: TileRect[];
  /** Scale the tiles are rendered at; the live zoom scales this down, so they stay sharp. */
  renderScale: number;
};

type Props = {
  session: InflateSession;
  itemsById: Map<string, Item>;
  activeId: string | null;
  /** Finger / pointer in canvas-container coordinates. */
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  /** World point shown at the bubble's centre, and world-to-bubble zoom. Both animated. */
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  zoom: SharedValue<number>;
  progress: SharedValue<number>;
  /** Container width, and the lowest top the bubble may use before flipping below the finger. */
  viewWidth: number;
  minTop: number;
};

export const BUBBLE_W = tokens.width;
export const BUBBLE_H = tokens.height;
const R = tokens.radius;
const TAIL = tokens.tail;
// Half the rotated square's diagonal: how far the tail tip sticks out of the bubble.
const TAIL_OUT = (TAIL * Math.SQRT2) / 2;

/**
 * A magnified bubble that pops out of the fingertip and floats above it, showing the
 * held tile whole, with a little of its surroundings, so the finger never covers it.
 */
export function InflateBubble({ session, itemsById, activeId, fx, fy, cx, cy, zoom, progress, viewWidth, minTop }: Props) {
  const W = Math.min(BUBBLE_W, viewWidth - 24);
  const H = BUBBLE_H;
  const z0 = session.renderScale;

  const placement = useDerivedValue(() => {
    const x = fx.get();
    const y = fy.get();
    const left = Math.min(Math.max(x - W / 2, 12), viewWidth - W - 12);
    const above = y - tokens.fingerGap - TAIL_OUT - H;
    const below = above < minTop;
    const top = below ? y + tokens.fingerGap + TAIL_OUT : above;
    const tailX = Math.min(Math.max(x - left, R), W - R);
    return { left, top, below, tailX };
  });

  // Grow out of the tail tip, with a little overshoot from the spring.
  const frame = useAnimatedStyle(() => {
    const { left, top, below, tailX } = placement.get();
    const p = progress.get();
    const ox = tailX - W / 2;
    const oy = below ? -H / 2 : H / 2;
    return {
      opacity: Math.min(1, p * 2),
      transform: [
        { translateX: left },
        { translateY: top },
        { translateX: ox },
        { translateY: oy },
        { scale: 0.2 + 0.8 * p },
        { translateX: -ox },
        { translateY: -oy },
      ],
    };
  });

  const tail = useAnimatedStyle(() => {
    const { below, tailX } = placement.get();
    return { left: tailX - TAIL / 2, top: below ? -TAIL / 2 : H - TAIL / 2 };
  });

  const ox = useDerivedValue(() => W / 2 - cx.get() * zoom.get());
  const oy = useDerivedValue(() => H / 2 - cy.get() * zoom.get());
  const content = useAnimatedStyle(() => ({
    transform: [{ translateX: ox.get() }, { translateY: oy.get() }, { scale: zoom.get() / z0 }],
  }));

  const active = activeId ? itemsById.get(activeId) : undefined;

  return (
    <Animated.View style={[styles.frame, { width: W, height: H }, frame]}>
      <Animated.View style={[styles.tail, tail]} />
      <View style={[styles.shadow, { borderRadius: R }]} />
      <View style={[styles.clip, { borderRadius: R }]}>
        <DotGrid id="inflate-dots" tx={ox} ty={oy} scale={zoom} width={W} height={H} />
        <Animated.View style={[styles.world, content]}>
          {session.tiles.map((t) => {
            const item = itemsById.get(t.id);
            if (!item) return null;
            return (
              <View key={t.id} style={{ position: 'absolute', left: t.x * z0, top: t.y * z0 }}>
                <Tile
                  item={item}
                  width={t.w * z0}
                  height={t.h * z0}
                  k={z0}
                  overlay={
                    item.id === activeId && item.kind === 'video' && item.mediaUrl ? (
                      <BubbleVideo uri={item.mediaUrl} />
                    ) : null
                  }
                />
              </View>
            );
          })}
        </Animated.View>
        <Sheen width={W} height={H} />
        {active ? <Caption item={active} /> : null}
      </View>
    </Animated.View>
  );
}

/** Soft light across the top edge so the bubble reads as raised glass. */
const Sheen = memo(function Sheen({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="inflate-sheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
          <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#inflate-sheen)" />
    </Svg>
  );
});

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

function Caption({ item }: { item: Item }) {
  return (
    <View style={styles.caption}>
      <Icon name={item.kind} size={14} strokeWidth={2} />
      <Text numberOfLines={1} style={styles.captionText}>
        {describe(item)}
      </Text>
    </View>
  );
}

/** Muted, looping autoplay for the video being held. Mounted only for that one tile. */
const BubbleVideo = memo(function BubbleVideo({ uri }: { uri: string }) {
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

const EDGE = 'rgba(255, 255, 255, 0.85)';

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
  tail: {
    position: 'absolute',
    width: TAIL,
    height: TAIL,
    borderRadius: 4,
    backgroundColor: colors.canvas,
    borderWidth: 1.5,
    borderColor: EDGE,
    transform: [{ rotate: '45deg' }],
  },
  shadow: { ...StyleSheet.absoluteFill, backgroundColor: colors.canvas, boxShadow: shadow.lens },
  clip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
    borderWidth: 1.5,
    borderColor: EDGE,
  },
  world: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
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
