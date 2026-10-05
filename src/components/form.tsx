import { useState, type Ref } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { backdrop, colors, fonts, shadow } from '@/theme/tokens';

type FieldProps = TextInputProps & { label: string; error?: string | null; ref?: Ref<TextInput> };

/** Glass text input with a label above it. */
export function TextField({ label, error, style, onFocus, onBlur, ref, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/** The saturated blue call to action. */
export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, off && styles.primaryOff, pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

/** Quiet glass button for secondary actions. */
export function SecondaryButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.secondaryText, danger && { color: '#FF6B6B' }]}>{label}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

/** Inline message under a form: error (red), success (green) or info. */
export function Notice({ kind = 'error', text }: { kind?: 'error' | 'success' | 'info'; text: string }) {
  return (
    <View
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      style={[styles.notice, kind === 'error' && styles.noticeError, kind === 'success' && styles.noticeSuccess]}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const webReset = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  fieldWrap: { gap: 6 },
  label: { fontFamily: fonts.sans, fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
    ...backdrop(14),
    ...webReset,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  inputError: { borderColor: '#FF6B6B' },
  fieldError: { fontFamily: fonts.sans, fontSize: 12.5, color: '#FF8A8A', marginLeft: 4 },
  primary: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    boxShadow: shadow.accent,
  },
  primaryOff: { opacity: 0.45, boxShadow: 'none' },
  primaryText: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '700', color: colors.accentText },
  secondary: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  secondaryText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '600', color: colors.text },
  link: { fontFamily: fonts.sans, fontSize: 14.5, fontWeight: '600', color: '#7FB0FF' },
  notice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  noticeError: { backgroundColor: 'rgba(255, 90, 90, 0.14)', borderColor: 'rgba(255, 90, 90, 0.4)' },
  noticeSuccess: { backgroundColor: 'rgba(60, 200, 120, 0.14)', borderColor: 'rgba(60, 200, 120, 0.4)' },
  noticeText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.text },
});
