import { useState } from 'react';
import { Text, View } from 'react-native';
import { verifyInviteCode } from '../../api/invites';
import { ApiError } from '../../api/client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface VerifyCodeStepProps {
  fileToken: string;
  organizationName: string;
  onVerified: (activationToken: string) => void;
}

export function VerifyCodeStep({ fileToken, organizationName, onVerified }: VerifyCodeStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await verifyInviteCode(fileToken, code);
      onVerified(data.activationToken);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Code incorrect. Après plusieurs essais, demandez un nouveau code à votre administrateur.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <Text className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          2. Code d'activation
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          Connecté à <Text className="font-semibold text-neutral-900 dark:text-neutral-100">{organizationName}</Text>.
          Contactez votre administrateur pour obtenir le code (transmis séparément du fichier).
        </Text>
      </View>
      <Input
        label="Code"
        value={code}
        onChangeText={t => setCode(t.toUpperCase())}
        placeholder="XXXXXXXX"
        className="text-center font-mono text-lg tracking-widest"
        maxLength={8}
        autoCapitalize="characters"
        autoFocus
      />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
      <Button onPress={submit} loading={loading} disabled={code.length < 4}>
        Vérifier
      </Button>
    </View>
  );
}
