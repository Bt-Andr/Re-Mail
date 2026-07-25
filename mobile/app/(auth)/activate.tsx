import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { UploadFileStep } from '../../src/components/activate/UploadFileStep';
import { VerifyCodeStep } from '../../src/components/activate/VerifyCodeStep';
import { SetPasswordStep } from '../../src/components/activate/SetPasswordStep';

export default function ActivateScreen() {
  const [fileToken, setFileToken] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [activationToken, setActivationToken] = useState<string | null>(null);

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
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Activer mon compte</Text>
          </View>

          {!fileToken && (
            <UploadFileStep
              onResolved={(token, orgName) => {
                setFileToken(token);
                setOrganizationName(orgName);
              }}
            />
          )}

          {fileToken && !activationToken && (
            <VerifyCodeStep fileToken={fileToken} organizationName={organizationName} onVerified={setActivationToken} />
          )}

          {fileToken && activationToken && (
            <SetPasswordStep fileToken={fileToken} activationToken={activationToken} />
          )}

          <Link href="/(auth)/login" asChild>
            <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Déjà activé ? <Text className="font-medium text-neutral-900 dark:text-neutral-100">Se connecter</Text>
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
