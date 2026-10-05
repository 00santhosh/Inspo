import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkyGradient } from '@/components/sky-gradient';
import { radius, shadow, sky } from '@/theme/tokens';

/** The sky-gradient card at the top of a screen, with rounded bottom corners and a soft shadow. */
export function SkyHeader({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }, style]}>
      {/* Clip only the gradient: overflow on the card itself would also clip its shadow on iOS. */}
      <View style={styles.clip}>
        <SkyGradient />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    borderBottomLeftRadius: radius.header,
    borderBottomRightRadius: radius.header,
    backgroundColor: sky.stops[0].color,
    boxShadow: shadow.header,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderBottomLeftRadius: radius.header,
    borderBottomRightRadius: radius.header,
    overflow: 'hidden',
  },
});
