// Expo SDK 53+ a remplacé le fetch global par sa propre implémentation ("winter"),
// qui ne supporte plus le pattern historique RN `formData.append('file', {uri, name,
// type})` — seules les vraies instances Blob/File sont acceptées pour une partie
// fichier (voir expo/src/winter/fetch/convertFormData.ts, throw "Unsupported
// FormDataPart implementation" sinon). Il faut donc convertir l'URI locale en Blob
// avant de l'attacher au FormData.
export async function appendFilePart(
  form: FormData,
  field: string,
  file: { uri: string; name: string; mimeType?: string | null }
): Promise<void> {
  const response = await fetch(file.uri);
  let blob = await response.blob();
  const type = file.mimeType || blob.type || 'application/octet-stream';
  if (blob.type !== type) blob = blob.slice(0, blob.size, type);
  form.append(field, blob, file.name);
}
