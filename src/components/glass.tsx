import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { backdrop, colors, fonts, radius, shadow } from '@/theme/tokens';

type Tone = 'sky' | 'dark' | 'plain';

/** Frosted pill with an optional icon, like the "Bruges" / "Designer" chips in the reference. */
export function GlassPill({ icon, label, tone = 'sky' }: { icon?: IconName; label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, tone === 'sky' ? styles.onSky : styles.onDark]}>
      {icon ? <Icon name={icon} size={15} strokeWidth={2} /> : null}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

/** Round frosted icon button, like the back / more buttons in the reference. */
export function GlassIconButton({
  icon,
  label,
  onPress,
  tone = 'dark',
  size = 44,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: Tone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        tone === 'sky' ? styles.onSky : tone === 'dark' ? styles.onDark : styles.plain,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
        style,
      ]}>
      <Icon name={icon} size={size * 0.48} />
    </Pressable>
  );
}

/** The saturated blue primary action with a coloured glow. */
export function AccentButton({
  icon,
  label,
  onPress,
  size = 56,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.accent,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={size * 0.46} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: shadow.glass,
  },
  onSky: { backgroundColor: colors.glassOnSky, borderColor: 'rgba(255, 255, 255, 0.22)', ...backdrop(16) },
  onDark: { backgroundColor: colors.glass, borderColor: colors.glassBorder, ...backdrop(16) },
  plain: { borderWidth: 0, boxShadow: 'none' },
  pillText: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '500', color: colors.text },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: shadow.glass,
  },
  accent: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    boxShadow: shadow.accent,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
