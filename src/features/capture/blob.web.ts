/** On web the picker and recorder hand back blob: / data: URLs, which fetch can read. */
export async function readBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}
