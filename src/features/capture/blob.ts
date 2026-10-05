import { File } from 'expo-file-system';

/**
 * A local file as something fetch can upload. On native this is expo-file-system's File,
 * which implements Blob and streams from disk, so large videos are never read into memory.
 */
export async function readBlob(uri: string): Promise<Blob> {
  return new File(uri) as unknown as Blob;
}
