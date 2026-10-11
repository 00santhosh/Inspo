import type { ImagePickerAsset } from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';

import type { OnFiles } from './use-file-drop';

export const canDropFiles = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;

const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

async function toAsset(file: File): Promise<ImagePickerAsset> {
  const uri = URL.createObjectURL(file);
  const isImage = file.type.startsWith('image/');
  const { width, height } = isImage ? await imageSize(uri) : { width: 0, height: 0 };
  return { uri, width, height, type: isImage ? 'image' : 'video', mimeType: file.type, fileName: file.name, fileSize: file.size };
}

/** Lets the user drop images and videos anywhere on the page. Returns true while files are being dragged over it. */
export function useFileDrop(onFiles: OnFiles, enabled = true): boolean {
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onFiles);
  useEffect(() => {
    handler.current = onFiles;
  });

  useEffect(() => {
    if (!enabled || !canDropFiles) return;
    // dragenter/dragleave also fire for every child element, so count them.
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // required, or the browser opens the file instead
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      const accepted = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
      handler.current(await Promise.all(accepted.map(toAsset)), files.length - accepted.length);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [enabled]);

  return dragging;
}
