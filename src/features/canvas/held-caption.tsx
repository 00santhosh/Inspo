import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { describeItem } from '@/lib/format';
import type { Item } from '@/lib/types';
import { backdrop, colors, fonts, shadow } from '@/theme/tokens';

const WIDTH = 220;
const HEIGHT = 30;

type Props = {
  item: Item;
  /** Bulge centre (container coordinates), its radius, its strength, and the container width. */
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  radius: number;
  strength: SharedValue<number>;
  viewWidth: number;
};

/** Says what the held item is, floating just above the bulge (or below it near the top). */
export function HeldCaption({ item, cx, cy, radius, strength, viewWidth }: Props) {
  const style = useAnimatedStyle(() => {
    const above = cy.get() - radius - HEIGHT - 10;
    const top = above < 4 ? cy.get() + radius + 10 : above;
    const left = Math.min(Math.max(cx.get() - WIDTH / 2, 8), viewWidth - WIDTH - 8);
    return {
      opacity: Math.min(1, Math.max(0, (strength.get() - 0.5) * 2)),
      transform: [{ translateX: left }, { translateY: top }],
    };
  });
  return (
    <Animated.View style={[styles.caption, style]}>
      <Icon name={item.kind} size={14} strokeWidth={2} />
      <Text numberOfLines={1} style={styles.text}>
        {describeItem(item)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  caption: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: WIDTH,
    height: HEIGHT,
    paddingHorizontal: 11,
    borderRadius: HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dock,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: shadow.glass,
    pointerEvents: 'none',
    ...backdrop(14),
  },
  text: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, fontWeight: '600', color: colors.text },
});
