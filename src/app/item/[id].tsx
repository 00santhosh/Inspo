import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useItem } from '@/data/items';
import { formatDuration } from '@/features/canvas/tile';
import type { Item } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);
  const insets = useSafeAreaInsets();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.bar}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      {item ? <Body item={item} /> : <Text style={styles.missing}>This item isn’t on your canvas any more.</Text>}
    </View>
  );
}

function Body({ item }: { item: Item }) {
  switch (item.kind) {
    case 'image':
      return (
        <Image
          source={{ uri: item.mediaUrl ?? item.thumbUrl ?? undefined }}
          placeholder={{ uri: item.thumbUrl ?? undefined }}
          style={styles.media}
          contentFit="contain"
        />
      );
    case 'video':
      return item.mediaUrl ? <DetailVideo uri={item.mediaUrl} /> : null;
    case 'link':
      return (
        <ScrollView contentContainerStyle={styles.card}>
          {item.link?.imageUrl ? (
            <Image source={{ uri: item.link.imageUrl }} style={styles.linkImage} contentFit="cover" />
          ) : null}
          <Text style={styles.heading}>{item.link?.title ?? item.link?.url}</Text>
          {item.link?.description ? <Text style={styles.body}>{item.link.description}</Text> : null}
          {item.link?.url ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(item.link!.url)} style={styles.primary}>
              <Text style={styles.primaryText}>Open {item.link.siteName ?? 'link'}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      );
    case 'note':
      return (
        <ScrollView contentContainerStyle={[styles.card, { backgroundColor: colors.noteYellow }]}>
          <Text style={[styles.body, { fontSize: 20, lineHeight: 28 }]}>{item.body}</Text>
        </ScrollView>
      );
    case 'voice':
      return <DetailVoice item={item} />;
  }
}

function DetailVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />;
}

function DetailVoice({ item }: { item: Item }) {
  const player = useAudioPlayer(item.mediaUrl ?? null);
  const status = useAudioPlayerStatus(player);
  return (
    <View style={[styles.card, { backgroundColor: colors.voice }]}>
      <Text style={styles.heading}>{item.title ?? 'Voice note'}</Text>
      <Text style={styles.body}>{formatDuration(item.durationMs)}</Text>
      {item.mediaUrl ? (
        <Pressable onPress={() => (status.playing ? player.pause() : player.play())} style={styles.primary}>
          <Text style={styles.primaryText}>{status.playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
      ) : (
        <Text style={styles.body}>Demo voice notes have no audio.</Text>
      )}
      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 16, gap: 12 },
  bar: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.surface, justifyContent: 'center' },
  closeText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '600', color: colors.text },
  media: { flex: 1, borderRadius: radius.tile },
  card: { borderRadius: radius.tile, backgroundColor: colors.surface, padding: 20, gap: 12 },
  linkImage: { width: '100%', aspectRatio: 1.9, borderRadius: radius.tile - 4 },
  heading: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '700', color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 22, color: colors.textSecondary },
  primary: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.chipActive,
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: '600', color: colors.chipActiveText },
  missing: { fontFamily: fonts.sans, fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
