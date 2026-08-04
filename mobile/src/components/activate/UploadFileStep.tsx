import { useState } from 'react';
import { Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Upload } from 'lucide-react-native';
import { resolveInviteFile } from '../../api/invites';
import { describeError } from '../../api/client';
import { Button } from '../ui/Button';

interface UploadFileStepProps {
  onResolved: (fileToken: string, organizationName: string) => void;
}

export function UploadFileStep({ onResolved }: UploadFileStepProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFileName(asset.name);
    setFileUri(asset.uri);
    setMimeType(asset.mimeType ?? null);
    setError('');
  };

  const submit = async () => {
    if (!fileUri || !fileName) return;
    setError('');
    setLoading(true);
    try {
      const data = await resolveInviteFile({ uri: fileUri, name: fileName, mimeType });
      onResolved(data.fileToken, data.organizationName);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <Text className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          1. Fichier d'activation
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          Le fichier que votre administrateur vous a transmis.
        </Text>
      </View>
      <Button variant="secondary" onPress={pickFile} className="flex-col gap-2 border border-dashed border-neutral-300 py-8 dark:border-neutral-700">
        <>
          <Upload size={22} color="#6b7280" />
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">{fileName ?? 'Choisir un fichier'}</Text>
        </>
      </Button>
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
      <Button onPress={submit} loading={loading} disabled={!fileUri}>
        Continuer
      </Button>
    </View>
  );
}
