import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { ItemKind } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

export type Filter = 'all' | ItemKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'link', label: 'Links' },
  { key: 'note', label: 'Notes' },
  { key: 'voice', label: 'Voice' },
];

/** Text tabs (white when active, grey otherwise), as in the reference's Stories / Posts row. */
export function FilterTabs({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist">
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={8}>
            <Text style={[styles.label, active && styles.active]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 18, gap: 20, alignItems: 'center', height: 44 },
  label: { fontFamily: fonts.sans, fontSize: 17, fontWeight: '500', color: colors.textTertiary },
  active: { color: colors.text, fontWeight: '600' },
});
