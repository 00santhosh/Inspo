import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Notice, PrimaryButton, TextField } from '@/components/form';
import { ModalShell } from '@/components/modal-shell';
import { MAX_NOTE_CHARS } from '@/features/capture/pipeline';
import { useCapture } from '@/features/capture/use-capture';
import { colors, fonts } from '@/theme/tokens';

export default function AddNote() {
  const { saveNote } = useCapture();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const failure = await saveNote({ title, body });
    setBusy(false);
    if (failure) setError(failure);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ModalShell title="New note">
      <TextField label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Card force idea" maxLength={120} returnKeyType="next" />
      <TextField
        label="Note"
        value={body}
        onChangeText={setBody}
        placeholder="Write it down before it’s gone…"
        multiline
        autoFocus
        textAlignVertical="top"
        maxLength={MAX_NOTE_CHARS}
        style={styles.body}
      />
      <Text style={styles.count}>
        {body.length.toLocaleString()} / {MAX_NOTE_CHARS.toLocaleString()}
      </Text>
      {error ? <Notice text={error} /> : null}
      <PrimaryButton label="Save note" onPress={save} loading={busy} disabled={!body.trim()} />
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  body: { height: 220, paddingTop: 14, lineHeight: 22 },
  count: { fontFamily: fonts.sans, fontSize: 12, color: colors.textTertiary, textAlign: 'right', marginTop: -8 },
});
