import { useVideoPlayer, VideoView } from 'expo-video';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { DotGrid } from '@/features/canvas/dot-grid';
import type { TileRect } from '@/features/canvas/layout';
import { Tile } from '@/features/canvas/tile';
import { LensRim } from '@/features/lens/lens-rim';
import type { Item } from '@/lib/types';
import { colors, lens as tokens, shadow } from '@/theme/tokens';

export type LensSession = {
  /** Tiles near the viewport when the lens opened; only these are drawn inside it. */
  tiles: TileRect[];
  /** Canvas transform at open time. It cannot change while the lens is up. */
  tx: number;
  ty: number;
  scale: number;
};

type Props = {
  session: LensSession;
  itemsById: Map<string, Item>;
  activeId: string | null;
  /** Finger / pointer position in canvas-container coordinates. */
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  progress: SharedValue<number>;
};

const D = tokens.diameter;
const R = D / 2;
const M = tokens.magnification;

/**
 * A circular window onto a magnified copy of the canvas. Tiles are re-rendered at
 * the magnified size (not a scaled bitmap) so images and text stay sharp.
 */
export function Lens({ session, itemsById, activeId, fx, fy, progress }: Props) {
  const z = session.scale * M;

  const frame = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: Math.min(1, p * 1.4),
      transform: [{ translateX: fx.get() - R }, { translateY: fy.get() - R }, { scale: 0.7 + 0.3 * p }],
    };
  });

  // Keep the world point under the finger at the lens centre.
  const cx = useDerivedValue(() => R - (fx.get() - session.tx) * M);
  const cy = useDerivedValue(() => R - (fy.get() - session.ty) * M);
  const zv = useDerivedValue(() => z);

  const content = useAnimatedStyle(() => ({
    transform: [{ translateX: cx.get() }, { translateY: cy.get() }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.frame, frame]}>
      <View style={styles.shadow} />
      <View style={styles.clip}>
        <DotGrid id="lens-dots" tx={cx} ty={cy} scale={zv} width={D} height={D} />
        <Animated.View style={[styles.world, content]}>
          {session.tiles.map((t) => {
            const item = itemsById.get(t.id);
            if (!item) return null;
            return (
              <View key={t.id} style={{ position: 'absolute', left: t.x * z, top: t.y * z }}>
                <Tile
                  item={item}
                  width={t.w * z}
                  height={t.h * z}
                  k={z}
                  overlay={item.id === activeId && item.kind === 'video' && item.mediaUrl ? <LensVideo uri={item.mediaUrl} /> : null}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>
      <LensRim size={D} />
    </Animated.View>
  );
}

/** Muted, looping autoplay for the video under the lens. Mounted only for that one tile. */
const LensVideo = memo(function LensVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
});

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 0, top: 0, width: D, height: D },
  shadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R,
    backgroundColor: colors.canvas,
    boxShadow: shadow.lens,
  },
  clip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  world: { position: 'absolute', left: 0, top: 0 },
});
