import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AccentButton, GlassIconButton } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import type { ItemKind } from '@/lib/types';
import { backdrop, colors, fonts, radius, shadow } from '@/theme/tokens';

const FORMATS: { kind: ItemKind; icon: IconName; label: string }[] = [
  { kind: 'image', icon: 'image', label: 'Image' },
  { kind: 'video', icon: 'video', label: 'Video' },
  { kind: 'link', icon: 'link', label: 'Link' },
  { kind: 'note', icon: 'note', label: 'Note' },
  { kind: 'voice', icon: 'voice', label: 'Voice' },
];

const hasLiquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

type Props = {
  onCapture?: (kind: ItemKind) => void;
  onResetView?: () => void;
  onSearch?: () => void;
};

/**
 * Floating bottom bar in the reference's style: frosted dark glass with the blue "+"
 * in the middle. "+" opens a tray with the five capture formats.
 */
export function CaptureDock({ onCapture, onResetView, onSearch }: Props) {
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggle = (next = !open) => {
    setOpen(next);
    progress.set(withSpring(next ? 1 : 0, { damping: 16, stiffness: 240, mass: 0.7 }));
  };

  const tray = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 16 }, { scale: 0.94 + 0.06 * progress.get() }],
  }));
  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.get() * 45}deg` }] }));

  const bar = (
    <>
      <GlassIconButton icon="grid" label="Reset canvas view" onPress={onResetView} tone="plain" />
      <Animated.View style={plus}>
        <AccentButton icon="plus" label={open ? 'Close capture options' : 'Capture'} onPress={() => toggle()} />
      </Animated.View>
      <GlassIconButton icon="search" label="Search" onPress={onSearch} tone="plain" />
    </>
  );

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.tray, tray, { pointerEvents: open ? 'auto' : 'none' }]} aria-hidden={!open}>
        {FORMATS.map((f) => (
          <Pressable
            key={f.kind}
            accessibilityRole="button"
            accessibilityLabel={`Add ${f.label.toLowerCase()}`}
            onPress={() => {
              toggle(false);
              onCapture?.(f.kind);
            }}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}>
            <View style={styles.optionIcon}>
              <Icon name={f.icon} size={22} />
            </View>
            <Text style={styles.optionLabel}>{f.label}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {hasLiquidGlass ? (
        <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive style={[styles.bar, styles.barShadow]}>
          {bar}
        </GlassView>
      ) : (
        <View style={[styles.bar, styles.barFallback]}>{bar}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 14,
    height: 72,
    borderRadius: radius.pill,
  },
  barShadow: { boxShadow: shadow.dock },
  barFallback: {
    backgroundColor: colors.dock,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: shadow.dock,
    ...backdrop(22),
  },
  tray: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    borderRadius: 26,
    backgroundColor: colors.dock,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: shadow.dock,
    ...backdrop(22),
  },
  option: { width: 58, alignItems: 'center', gap: 5, paddingVertical: 4 },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  optionLabel: { fontFamily: fonts.sans, fontSize: 11.5, fontWeight: '500', color: colors.textSecondary },
});
