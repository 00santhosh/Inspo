import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Notice, PrimaryButton, TextField } from '@/components/form';
import { ModalShell } from '@/components/modal-shell';
import { useCapture } from '@/features/capture/use-capture';
import { colors, fonts } from '@/theme/tokens';

export default function AddLink() {
  const { saveLink } = useCapture();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await saveLink(url);
    setBusy(false);
    if (failure) setError(failure);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ModalShell title="Save a link">
      <TextField
        label="Link"
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          setError(null);
        }}
        placeholder="https://…"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Text style={styles.hint}>We’ll fetch the title and picture from the page so it shows up as a card on your canvas.</Text>
      {error ? <Notice text={error} /> : null}
      <PrimaryButton label={busy ? 'Fetching preview…' : 'Save link'} onPress={save} loading={busy} disabled={!url.trim()} />
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary, marginTop: -4 },
});
