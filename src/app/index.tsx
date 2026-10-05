import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureDock } from '@/components/capture-dock';
import { FilterTabs, type Filter } from '@/components/filter-tabs';
import { GlassIconButton, GlassPill } from '@/components/glass';
import { Icon } from '@/components/icons';
import { SkyHeader } from '@/components/sky-header';
import { useItems } from '@/data/items';
import { Canvas } from '@/features/canvas/canvas';
import { useCapture } from '@/features/capture/use-capture';
import type { ItemKind } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

const NOUN: Record<ItemKind, string> = { image: 'images', video: 'videos', link: 'links', note: 'notes', voice: 'voice notes' };

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const { items, source, loading, error, refresh } = useItems();
  const capture = useCapture();
  const [filter, setFilter] = useState<Filter>('all');
  const [resetSignal, setResetSignal] = useState(0);
  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kind === filter)), [items, filter]);

  const onCapture = (kind: ItemKind) => {
    if (!capture.signedIn) return capture.needSignIn();
    if (kind === 'image') capture.addImages();
    else if (kind === 'video') capture.addVideos();
    else router.push(`/add/${kind}`);
  };

  const showLoading = loading && items.length === 0;
  const showEmpty = !loading && !error && visible.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <SkyHeader>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              Canvas
            </Text>
            <GlassIconButton icon="user" label="Account" tone="sky" size={40} onPress={() => router.push('/account')} />
          </View>
          <View style={styles.pills}>
            {!showLoading && <GlassPill icon="bookmark" label={`${items.length} saved`} />}
            {source === 'demo' && <GlassPill icon="sparkle" label="Demo content" />}
          </View>
        </SkyHeader>
        <FilterTabs value={filter} onChange={setFilter} />
      </View>

      <Canvas items={visible} resetSignal={resetSignal} />

      {showLoading ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.textSecondary} />
          <Text style={styles.hint}>Loading your canvas…</Text>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.center} pointerEvents="none">
          <Icon name={filter === 'all' ? 'sparkle' : (filter as ItemKind)} size={34} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>{filter === 'all' ? 'Your canvas is empty' : `No ${NOUN[filter]} yet`}</Text>
          <Text style={styles.hint}>
            {filter === 'all'
              ? 'Tap + to add an image, video, link, note or voice note.'
              : 'Tap + to add one. Switch to All to see everything.'}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.center}>
          <Icon name="close" size={30} color="#FF8A8A" />
          <Text style={styles.emptyTitle}>Couldn’t load your canvas</Text>
          <Text style={styles.hint}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.dockWrap, { bottom: insets.bottom + 14 }]}>
        <CaptureDock onCapture={onCapture} onResetView={() => setResetSignal((n) => n + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { zIndex: 1, backgroundColor: colors.canvas },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.sans, fontSize: 36, fontWeight: '800', letterSpacing: -0.9, color: colors.text },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', minHeight: 32 },
  center: {
    ...StyleSheet.absoluteFill,
    top: 230,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyTitle: { fontFamily: fonts.sans, fontSize: 19, fontWeight: '700', color: colors.text, textAlign: 'center' },
  hint: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  retry: { marginTop: 6, paddingHorizontal: 20, height: 42, borderRadius: 21, backgroundColor: colors.accent, justifyContent: 'center' },
  retryText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '700', color: '#fff' },
  // The canvas sits at zIndex 2 so its balloon can overlap the header; the dock stays on top.
  dockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 3, pointerEvents: 'box-none' },
});
