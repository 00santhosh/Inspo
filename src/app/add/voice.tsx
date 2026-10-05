import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Notice, PrimaryButton, SecondaryButton, TextField } from '@/components/form';
import { Icon } from '@/components/icons';
import { ModalShell } from '@/components/modal-shell';
import { MAX_VOICE_SECONDS } from '@/features/capture/pipeline';
import { useCapture } from '@/features/capture/use-capture';
import { formatDuration } from '@/lib/format';
import { colors, fonts, shadow } from '@/theme/tokens';

type Phase = 'idle' | 'recording' | 'review';
const MIN_MS = 800;

export default function AddVoice() {
  const { saveVoice } = useCapture();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 200);
  const [phase, setPhase] = useState<Phase>('idle');
  const [take, setTake] = useState<{ uri: string; durationMs: number } | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useAudioPlayer(take?.uri ?? null);
  const playing = useAudioPlayerStatus(player).playing;

  const start = async () => {
    setError(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError(
          Platform.OS === 'web'
            ? 'Microphone access is blocked. Allow it from the lock icon in your browser’s address bar, then try again.'
            : 'Microphone access is off. Turn it on for Inspo Canvas in your phone’s Settings.',
        );
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      // Stop on its own at the length limit.
      limitTimer.current = setTimeout(() => stop(), MAX_VOICE_SECONDS * 1000);
    } catch {
      setError('Couldn’t start recording. Is another app using the microphone?');
    }
  };

  const stop = async () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    // Read the recorder itself: this can run from a timer holding an old render's values.
    const durationMs = recorder.getStatus().durationMillis;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      // Fall through: the checks below decide whether there is anything to keep.
    }
    const uri = recorder.uri;
    if (!uri || durationMs < MIN_MS) {
      setError('That was too short. Hold on a little longer and try again.');
      setPhase('idle');
      return;
    }
    setTake({ uri, durationMs });
    setPhase('review');
  };

  // Leaving mid-recording must release the microphone.
  useEffect(
    () => () => {
      if (limitTimer.current) clearTimeout(limitTimer.current);
      if (recorder.isRecording) recorder.stop().catch(() => {});
    },
    [recorder],
  );

  const redo = () => {
    player.pause();
    setTake(null);
    setPhase('idle');
    setError(null);
  };

  const save = async () => {
    if (!take) return;
    player.pause();
    setBusy(true);
    setError(null);
    const failure = await saveVoice({ ...take, title });
    setBusy(false);
    if (failure) setError(failure);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ModalShell title="Voice note">
      <View style={styles.stage}>
        <Text accessibilityLiveRegion="polite" style={styles.time}>
          {formatDuration(phase === 'review' ? take?.durationMs : rec.durationMillis) || '0:00'}
        </Text>
        <Text style={styles.caption}>
          {phase === 'idle' ? 'Tap to start recording' : phase === 'recording' ? 'Recording… tap to stop' : 'Listen back, then save'}
        </Text>

        {phase === 'review' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            onPress={() => (playing ? player.pause() : player.play())}
            style={({ pressed }) => [styles.round, styles.roundAccent, pressed && { opacity: 0.8 }]}>
            <Icon name={playing ? 'pause' : 'play'} size={40} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start recording'}
            onPress={phase === 'recording' ? stop : start}
            style={({ pressed }) => [styles.round, phase === 'recording' ? styles.roundRec : styles.roundAccent, pressed && { opacity: 0.8 }]}>
            <Icon name={phase === 'recording' ? 'stop' : 'voice'} size={40} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      {error ? <Notice text={error} /> : null}

      {phase === 'review' ? (
        <>
          <TextField label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Idea on the train" maxLength={120} />
          <PrimaryButton label="Save voice note" onPress={save} loading={busy} />
          <SecondaryButton label="Record again" onPress={redo} />
        </>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  time: { fontFamily: fonts.sans, fontSize: 56, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  caption: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.textSecondary, marginBottom: 18 },
  round: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  roundAccent: { backgroundColor: colors.accent, boxShadow: shadow.accent },
  roundRec: { backgroundColor: '#E5484D', boxShadow: '0px 6px 24px rgba(229, 72, 77, 0.55)' },
});
