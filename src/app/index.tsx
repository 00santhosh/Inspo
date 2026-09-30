import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureDock } from '@/components/capture-dock';
import { FilterTabs, type Filter } from '@/components/filter-tabs';
import { GlassPill } from '@/components/glass';
import { SkyGradient } from '@/components/sky-gradient';
import { useItems } from '@/data/items';
import { Canvas } from '@/features/canvas/canvas';
import { colors, fonts, radius, shadow, sky } from '@/theme/tokens';

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const { items, source } = useItems();
  const [filter, setFilter] = useState<Filter>('all');
  const [resetSignal, setResetSignal] = useState(0);
  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kind === filter)), [items, filter]);

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerClip}>
            <SkyGradient />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Canvas
          </Text>
          <View style={styles.pills}>
            <GlassPill icon="bookmark" label={`${items.length} saved`} />
            {source === 'demo' && <GlassPill icon="sparkle" label="Demo content" />}
          </View>
        </View>
        <FilterTabs value={filter} onChange={setFilter} />
      </View>

      <Canvas items={visible} resetSignal={resetSignal} />

      <View style={[styles.dockWrap, { bottom: insets.bottom + 14 }]}>
        {/* Capture flows and search are the next milestones; the buttons are visual for now. */}
        <CaptureDock onResetView={() => setResetSignal((n) => n + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { zIndex: 1, backgroundColor: colors.canvas },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    borderBottomLeftRadius: radius.header,
    borderBottomRightRadius: radius.header,
    backgroundColor: sky.stops[0].color,
    boxShadow: shadow.header,
  },
  // Clip only the gradient: overflow on the header itself would also clip its shadow on iOS.
  headerClip: {
    ...StyleSheet.absoluteFill,
    borderBottomLeftRadius: radius.header,
    borderBottomRightRadius: radius.header,
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: colors.text,
  },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  // The canvas sits at zIndex 2 so its lens can overlap the header; the dock stays on top.
  dockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 3, pointerEvents: 'box-none' },
});
