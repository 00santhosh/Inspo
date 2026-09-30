import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { ItemKind } from '@/lib/types';
import { colors, radius, shadow } from '@/theme/tokens';

const stroke = { stroke: colors.text, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<ItemKind, ReactNode> = {
  image: (
    <>
      <Rect x={3} y={4} width={18} height={16} rx={3} {...stroke} />
      <Circle cx={9} cy={10} r={1.6} {...stroke} />
      <Path d="M4 18l5-5 4 4 3-3 4 4" {...stroke} />
    </>
  ),
  video: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={3} {...stroke} />
      <Path d="M10 9.5v5l4.2-2.5z" {...stroke} />
    </>
  ),
  link: (
    <>
      <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" {...stroke} />
      <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...stroke} />
    </>
  ),
  note: (
    <>
      <Rect x={4} y={3} width={16} height={18} rx={3} {...stroke} />
      <Path d="M8 8h8M8 12h8M8 16h5" {...stroke} />
    </>
  ),
  voice: (
    <>
      <Rect x={9} y={3} width={6} height={11} rx={3} {...stroke} />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...stroke} />
    </>
  ),
};

const ORDER: { kind: ItemKind; label: string }[] = [
  { kind: 'image', label: 'Add image' },
  { kind: 'video', label: 'Add video' },
  { kind: 'link', label: 'Add link' },
  { kind: 'note', label: 'Add note' },
  { kind: 'voice', label: 'Record voice note' },
];

const hasLiquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

/** Floating capture dock. Liquid Glass on iOS 26+, a frosted translucent pill elsewhere. */
export function CaptureDock({ onCapture }: { onCapture?: (kind: ItemKind) => void }) {
  const buttons = ORDER.map(({ kind, label }) => (
    <Pressable
      key={kind}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onCapture?.(kind)}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.55 }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        {ICONS[kind]}
      </Svg>
    </Pressable>
  ));

  return hasLiquidGlass ? (
    <GlassView glassEffectStyle="regular" isInteractive style={[styles.dock, styles.glassShadow]}>
      {buttons}
    </GlassView>
  ) : (
    <View style={[styles.dock, styles.fallback]}>{buttons}</View>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 60,
    borderRadius: radius.dock,
  },
  glassShadow: { boxShadow: shadow.dock },
  fallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    boxShadow: shadow.dock,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px) saturate(180%)' } as object) : null),
  },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
