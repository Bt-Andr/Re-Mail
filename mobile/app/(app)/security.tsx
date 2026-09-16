import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { changePassword } from '../../src/api/auth';
import { describeError } from '../../src/api/client';
import { useSession } from '../../src/context/SessionContext';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

export default function SecurityScreen() {
  const { logout } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) return setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    if (newPassword !== confirmation) return setError('Les nouveaux mots de passe ne correspondent pas.');
    setError('');
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      await logout();
      router.replace({ pathname: '/(auth)/login', params: { passwordChanged: '1' } });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-neutral-50 p-4 dark:bg-neutral-950">
      <View className="gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">Changer votre mot de passe déconnecte toutes vos autres sessions.</Text>
        <Input label="Mot de passe actuel" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Input label="Nouveau mot de passe" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Input label="Confirmer le nouveau mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry />
        {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
        <Button onPress={submit} loading={loading} disabled={!currentPassword || !newPassword || !confirmation}>
          Changer le mot de passe
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
