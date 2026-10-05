import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';

export type VideoFrame = { uri: string; width: number; height: number; durationMs?: number };

/** A JPEG still from the video, or null if one can't be made (the video is still saved). */
export async function videoThumbnail(uri: string): Promise<VideoFrame | null> {
  const player = createVideoPlayer(uri);
  try {
    // One second in usually skips a black first frame; very short clips fall back to the start.
    let frames = await player.generateThumbnailsAsync(1, { maxWidth: 480 }).catch(() => []);
    if (!frames.length) frames = await player.generateThumbnailsAsync(0, { maxWidth: 480 });
    if (!frames.length) return null;
    const image = await ImageManipulator.manipulate(frames[0]).renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  } catch {
    return null;
  } finally {
    player.release();
  }
}
