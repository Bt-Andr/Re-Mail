import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { activateInvite } from '../../api/invites';
import { describeError } from '../../api/client';
import { useSession } from '../../context/SessionContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface SetPasswordStepProps {
  fileToken: string;
  activationToken: string;
}

export function SetPasswordStep({ fileToken, activationToken }: SetPasswordStepProps) {
  const { login } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (password.length < 8) return setError('8 caractères minimum.');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.');

    setLoading(true);
    try {
      const data = await activateInvite(fileToken, activationToken, password);
      await login(data.token, data.user);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-4">
      <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        3. Créer votre mot de passe
      </Text>
      <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoFocus />
      <Input label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry onSubmitEditing={submit} />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
      <Button onPress={submit} loading={loading}>
        Activer mon compte
      </Button>
    </View>
  );
}
