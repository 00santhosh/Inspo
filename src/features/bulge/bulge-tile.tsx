import { memo } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { displace, type Rect } from '@/features/bulge/bulge-math';
import type { TileRect } from '@/features/canvas/layout';
import { Tile } from '@/features/canvas/tile';
import type { Item } from '@/lib/types';

type Props = {
  item: Item;
  rect: TileRect;
  index: number;
  /** The held tile's current and normal rects (world units), its index, the bulge strength and canvas zoom. */
  held: SharedValue<Rect>;
  base: SharedValue<Rect>;
  heldIndex: SharedValue<number>;
  strength: SharedValue<number>;
  scale: SharedValue<number>;
};

/** A canvas tile that slides away from, and shrinks around, the bulge. */
export const BulgeTile = memo(function BulgeTile({ item, rect, index, held, base, heldIndex, strength, scale }: Props) {
  const style = useAnimatedStyle(() => {
    const g = strength.get();
    if (g <= 0.001) return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    // The held tile is drawn sharp, at full size, by the focus overlay instead.
    if (heldIndex.get() === index) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    const d = displace(rect, held.get(), base.get(), g, scale.get());
    return { opacity: 1, transform: [{ translateX: d.dx }, { translateY: d.dy }, { scale: d.k }] };
  });

  return (
    <Animated.View style={[{ position: 'absolute', left: rect.x, top: rect.y }, style]}>
      <Tile item={item} width={rect.w} height={rect.h} />
    </Animated.View>
  );
});
