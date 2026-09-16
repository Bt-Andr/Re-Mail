import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { requestPasswordReset } from '../../src/api/auth';
import { describeError } from '../../src/api/client';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

export default function ForgotPasswordScreen() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(username.trim());
      setSent(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-sm gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Réinitialiser le mot de passe</Text>
          {sent ? (
            <>
              <Text className="text-sm text-neutral-600 dark:text-neutral-300">
                Si ce compte existe, un lien valable 30 minutes a été envoyé. Ouvrez-le depuis votre email pour choisir un nouveau mot de passe.
              </Text>
              <Link href="/(auth)/login" asChild>
                <Text className="text-center text-sm font-medium text-neutral-900 dark:text-neutral-100">Retour à la connexion</Text>
              </Link>
            </>
          ) : (
            <>
              <Text className="text-sm text-neutral-600 dark:text-neutral-300">Saisissez votre nom d’utilisateur.</Text>
              <Input label="Nom d'utilisateur" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
              {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
              <Button onPress={submit} loading={loading} disabled={!username.trim()}>Envoyer le lien</Button>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
