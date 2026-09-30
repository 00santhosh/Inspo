import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureDock } from '@/components/capture-dock';
import { FilterChips, type Filter } from '@/components/filter-chips';
import { useItems } from '@/data/items';
import { Canvas } from '@/features/canvas/canvas';
import { colors, fonts } from '@/theme/tokens';

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const { items, source } = useItems();
  const [filter, setFilter] = useState<Filter>('all');
  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kind === filter)), [items, filter]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            Canvas
          </Text>
          {source === 'demo' && <Text style={styles.demo}>Demo content</Text>}
        </View>
        <FilterChips value={filter} onChange={setFilter} />
      </View>

      <Canvas items={visible} />

      <View style={[styles.dockWrap, { bottom: insets.bottom + 16 }]}>
        {/* Capture flows are the next milestone; the dock is visual only for now. */}
        <CaptureDock />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { gap: 12, paddingBottom: 12, backgroundColor: colors.canvas, zIndex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontFamily: fonts.sans, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  demo: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  // The canvas sits at zIndex 2 so its lens can overlap the header; the dock stays on top.
  dockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 3, pointerEvents: 'box-none' },
});
