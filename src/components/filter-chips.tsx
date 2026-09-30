import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { ItemKind } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

export type Filter = 'all' | ItemKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'link', label: 'Links' },
  { key: 'note', label: 'Notes' },
  { key: 'voice', label: 'Voice' },
];

export function FilterChips({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.label, active && styles.labelActive]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.chipActive, borderColor: colors.chipActive },
  label: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '500', color: colors.text },
  labelActive: { color: colors.chipActiveText },
});
