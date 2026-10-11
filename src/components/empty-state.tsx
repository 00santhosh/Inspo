import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, TextLink } from '@/components/form';
import { Icon } from '@/components/icons';
import { canDropFiles } from '@/features/capture/use-file-drop';
import type { ItemKind } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

export type EmptyFilter = 'all' | ItemKind;

const OTHER_LINKS: { kind: ItemKind; label: string }[] = [
  { kind: 'link', label: 'Add a link' },
  { kind: 'note', label: 'Write a note' },
  { kind: 'voice', label: 'Record a voice note' },
];

const COPY: Record<ItemKind, { title: string; hint: string; cta: string }> = {
  image: {
    title: 'Add your inspirations',
    hint: 'Pick photos from your gallery and they’ll appear on your canvas.',
    cta: 'Choose from gallery',
  },
  video: { title: 'No videos yet', hint: 'Pick a video from your gallery to save it here.', cta: 'Choose a video' },
  link: { title: 'No links yet', hint: 'Paste a link to an article, post or site you want to remember.', cta: 'Add a link' },
  note: { title: 'No notes yet', hint: 'Jot down an idea before it slips away.', cta: 'Write a note' },
  voice: { title: 'No voice notes yet', hint: 'Record an idea out loud. It takes a few seconds.', cta: 'Record a voice note' },
};

/**
 * What a signed-in user sees when there is nothing on the canvas: what to do, and a button that does it.
 * On a desktop browser it is also a drop target for files.
 */
export function EmptyCanvas({ filter, onAdd }: { filter: EmptyFilter; onAdd: (kind: ItemKind) => void }) {
  const kind: ItemKind = filter === 'all' ? 'image' : filter;
  const copy = COPY[kind];
  const desktop = canDropFiles && (filter === 'all' || filter === 'image' || filter === 'video');
  const cta = desktop ? 'Choose from your device' : copy.cta;
  const hint = desktop
    ? 'Drag and drop images or videos anywhere on this page, or choose them from your device.'
    : copy.hint;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, desktop && styles.cardDashed]}>
        <View style={styles.iconBubble}>
          <Icon name={filter === 'all' ? 'image' : kind} size={28} color={colors.text} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {copy.title}
        </Text>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.cta}>
          <PrimaryButton label={cta} onPress={() => onAdd(kind)} />
        </View>
        {filter === 'all' ? (
          <View style={styles.others}>
            <Text style={styles.orText}>Or</Text>
            {OTHER_LINKS.map((o) => (
              <TextLink key={o.kind} label={o.label} onPress={() => onAdd(o.kind)} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Shown over the page while files are dragged onto it. */
export function DropOverlay() {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.overlayBox}>
        <Icon name="image" size={36} color={colors.text} />
        <Text style={styles.overlayTitle}>Drop to add to your canvas</Text>
        <Text style={styles.hint}>Images and videos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, top: 230, zIndex: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 110 },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 24, borderRadius: 24 },
  cardDashed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.glassBorder, backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  iconBubble: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, marginBottom: 4 },
  title: { fontFamily: fonts.sans, fontSize: 21, fontWeight: '700', color: colors.text, textAlign: 'center' },
  hint: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  cta: { width: '100%', maxWidth: 300, marginTop: 8 },
  others: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 14, rowGap: 6, marginTop: 6 },
  orText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.textTertiary },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 15, 20, 0.82)', padding: 20 },
  overlayBox: { width: '100%', maxWidth: 520, alignItems: 'center', gap: 10, paddingVertical: 56, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: 'rgba(29, 117, 253, 0.1)' },
  overlayTitle: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '700', color: colors.text },
});
