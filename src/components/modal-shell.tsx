import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassIconButton } from '@/components/glass';
import { colors, fonts } from '@/theme/tokens';

/** Frame for the add / account screens: title, close button, scrolling content. */
export function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.bar}>
        <GlassIconButton icon="close" label="Close" onPress={close} size={40} />
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 16 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  title: { fontFamily: fonts.sans, fontSize: 17, fontWeight: '700', color: colors.text },
  content: { flexGrow: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 24 },
  column: { width: '100%', maxWidth: 520, gap: 16 },
});
