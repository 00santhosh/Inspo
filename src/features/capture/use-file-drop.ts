import type { ImagePickerAsset } from 'expo-image-picker';

/** Called with the images and videos that were dropped, and how many other files were skipped. */
export type OnFiles = (assets: ImagePickerAsset[], skipped: number) => void;

/** Dragging files onto the page only exists on the web (see use-file-drop.web.ts). */
export function useFileDrop(_onFiles: OnFiles, _enabled = true): boolean {
  return false;
}

/** True on a desktop browser, where dragging files in makes sense. Phones and tablets only get the picker. */
export const canDropFiles = false;
