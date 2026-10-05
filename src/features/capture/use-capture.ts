import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo } from 'react';

import { useToast } from '@/components/toast';
import { useItems } from '@/data/items';
import {
  createItem,
  imageBuilder,
  linkBuilder,
  messageOf,
  noteBuilder,
  videoBuilder,
  voiceBuilder,
  type Built,
} from '@/features/capture/pipeline';
import { useAuth } from '@/lib/auth';

type Build = (id: string, track: (path: string) => void) => Promise<Built>;

const MAX_IMAGES_AT_ONCE = 10;
const MAX_VIDEOS_AT_ONCE = 5;

/**
 * Everything the "+" menu does: pick or write something, save it, and show the result
 * on the canvas. Picker flows report with toasts; the form screens get the error back
 * as text so they can show it next to the form.
 */
export function useCapture() {
  const { user, exitDemo } = useAuth();
  const { addRow, refresh } = useItems();
  const toast = useToast();
  const userId = user?.id ?? null;

  const needSignIn = useCallback(() => {
    toast.show('Sign in to save your own items.', { action: { label: 'Sign in', onPress: exitDemo } });
  }, [toast, exitDemo]);

  /** Puts a saved row on the canvas. If that fails the row still exists, so reload instead. */
  const show = useCallback(
    async (row: Parameters<typeof addRow>[0]) => {
      try {
        await addRow(row);
      } catch {
        refresh();
      }
    },
    [addRow, refresh],
  );

  /** Saves one item from a form screen. Resolves to an error message, or null on success. */
  const saveOne = useCallback(
    async (build: Build, saved: string): Promise<string | null> => {
      if (!userId) {
        needSignIn();
        return 'Sign in to save your own items.';
      }
      try {
        const { row, note } = await createItem(userId, build);
        await show(row);
        toast.show(note ? `${saved}. ${note}` : saved, { kind: note ? 'info' : 'success' });
        return null;
      } catch (e) {
        return messageOf(e);
      }
    },
    [userId, needSignIn, show, toast],
  );

  /** Saves a batch from a picker, with one progress message. */
  const saveMany = useCallback(
    async <T>(inputs: T[], noun: string, build: (input: T) => Build) => {
      if (!userId || !inputs.length) return;
      const busy = toast.show(`Saving ${noun}…`, { kind: 'busy' });
      let saved = 0;
      const failures: string[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (inputs.length > 1) toast.update(busy, `Saving ${noun} ${i + 1} of ${inputs.length}…`, { kind: 'busy' });
        try {
          const { row } = await createItem(userId, build(inputs[i]));
          await show(row);
          saved++;
        } catch (e) {
          failures.push(messageOf(e));
        }
      }
      toast.hide(busy);
      if (!failures.length) toast.show(saved === 1 ? `Saved 1 ${noun}` : `Saved ${saved} ${noun}s`, { kind: 'success' });
      else if (saved) toast.show(`Saved ${saved}, but ${failures.length} failed: ${failures[0]}`, { kind: 'error' });
      else toast.show(`Couldn’t save: ${failures[0]}`, { kind: 'error' });
    },
    [userId, show, toast],
  );

  const addImages = useCallback(async () => {
    if (!userId) return needSignIn();
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES_AT_ONCE,
      quality: 1,
    });
    if (picked.canceled) return;
    const build = imageBuilder(userId);
    await saveMany(picked.assets, 'image', (asset) => (id, track) => build(asset, id, track));
  }, [userId, needSignIn, saveMany]);

  const addVideos = useCallback(async () => {
    if (!userId) return needSignIn();
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_VIDEOS_AT_ONCE,
    });
    if (picked.canceled) return;
    const build = videoBuilder(userId);
    await saveMany(picked.assets, 'video', (asset) => (id, track) => build(asset, id, track));
  }, [userId, needSignIn, saveMany]);

  return useMemo(
    () => ({
      signedIn: !!userId,
      needSignIn,
      addImages,
      addVideos,
      saveLink: (url: string) => saveOne(linkBuilder(url), 'Link saved'),
      saveNote: (note: { title?: string; body: string }) => saveOne(noteBuilder(note), 'Note saved'),
      saveVoice: (voice: { uri: string; durationMs: number; title?: string }) =>
        userId ? saveOne(voiceBuilder(userId, voice), 'Voice note saved') : (needSignIn(), Promise.resolve('Sign in to save your own items.')),
    }),
    [addImages, addVideos, saveOne, userId, needSignIn],
  );
}
