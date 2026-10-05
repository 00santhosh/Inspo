import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ModalShell } from '@/components/modal-shell';
import { useItems } from '@/data/items';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius } from '@/theme/tokens';

export default function Account() {
  const { user, demo, signOut, exitDemo } = useAuth();
  const { items } = useItems();

  return (
    <ModalShell title="Account">
      {user ? (
        <>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.initial}>{(user.email ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Signed in as</Text>
              <Text numberOfLines={1} style={styles.email}>
                {user.email}
              </Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {items.length} {items.length === 1 ? 'item' : 'items'} on your canvas
          </Text>
          <SecondaryButton
            label="Sign out"
            onPress={async () => {
              if (router.canGoBack()) router.back();
              await signOut();
            }}
          />
        </>
      ) : (
        <>
          <Text style={styles.meta}>You’re looking around with demo content. Nothing here is saved.</Text>
          <PrimaryButton label={demo ? 'Sign in or create an account' : 'Sign in'} onPress={exitDemo} />
        </>
      )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  initial: { fontFamily: fonts.sans, fontSize: 20, fontWeight: '700', color: '#fff' },
  label: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.textSecondary },
  email: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary },
});
