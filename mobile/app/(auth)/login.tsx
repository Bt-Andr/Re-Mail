import { useState } from 'react';
import { Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { login as loginRequest } from '../../src/api/auth';
import { describeError } from '../../src/api/client';
import { useSession } from '../../src/context/SessionContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';

export default function LoginScreen() {
  const { login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await loginRequest(username.trim(), password);
      await login(data.token, data.user);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
    >
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-sm gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <View className="mb-2 flex-row items-center gap-2.5">
            <View className="h-7 w-7 items-center justify-center rounded-md bg-neutral-900 dark:bg-neutral-100">
              <Mail size={14} color="#fff" />
            </View>
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Connexion</Text>
          </View>

          <Input
            label="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button onPress={submit} loading={loading}>
            Se connecter
          </Button>

          <Link href="/(auth)/activate" asChild>
            <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Invité par un administrateur ?{' '}
              <Text className="font-medium text-neutral-900 dark:text-neutral-100">Activer mon compte</Text>
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
