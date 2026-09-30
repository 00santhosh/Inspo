import { memo } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { canvas, colors } from '@/theme/tokens';

type Props = {
  /** Where world (0, 0) sits in this layer's parent, and the world-to-screen scale. */
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
  width: number;
  height: number;
  id: string;
};

/**
 * Dot grid that follows pan and zoom without a world-sized bitmap: a viewport-sized
 * pattern is shifted by the pan offset (mod one cell) and scaled within a 1x–2x band.
 * Crossing a power of two adds or drops every other dot, so the grid stays aligned
 * with world space.
 */
export const DotGrid = memo(function DotGrid({ tx, ty, scale, width, height, id }: Props) {
  const s0 = canvas.dotSpacing;
  const pad = s0 * 2;
  const w = width + pad * 2;
  const h = height + pad * 2;

  const style = useAnimatedStyle(() => {
    const s = scale.get();
    const band = s / Math.pow(2, Math.floor(Math.log2(s)));
    const cell = s0 * band;
    const ox = (((tx.get() % cell) + cell) % cell) - cell;
    const oy = (((ty.get() % cell) + cell) % cell) - cell;
    return { transform: [{ translateX: ox }, { translateY: oy }, { scale: band }] };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: 'top left', pointerEvents: 'none' },
        style,
      ]}>
      <Svg width={w} height={h}>
        <Defs>
          <Pattern id={id} x={0} y={0} width={s0} height={s0} patternUnits="userSpaceOnUse">
            <Circle cx={0} cy={0} r={canvas.dotRadius} fill={colors.dot} />
            <Circle cx={s0} cy={0} r={canvas.dotRadius} fill={colors.dot} />
            <Circle cx={0} cy={s0} r={canvas.dotRadius} fill={colors.dot} />
            <Circle cx={s0} cy={s0} r={canvas.dotRadius} fill={colors.dot} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
});
