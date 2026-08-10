import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { ShieldCheck } from 'lucide-react-native';
import { Button } from './ui/Button';
import { getBiometricLockEnabled, setBiometricLockEnabled } from '../lib/biometricLock';

// Verrou d'écran local (en plus de la session — le token reste dans SecureStore
// quoi qu'il arrive), activable dans Réglages. Se désactive tout seul si le
// device n'a plus d'empreinte/visage enregistré, pour ne jamais bloquer
// définitivement l'accès au compte à la place de l'utilisateur.
export function BiometricGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const wasBackgroundRef = useRef(false);

  const authenticate = useCallback(async () => {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) {
      await setBiometricLockEnabled(false);
      setEnabled(false);
      setLocked(false);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Déverrouiller Re-Mail',
      cancelLabel: 'Annuler',
    });
    if (result.success) setLocked(false);
  }, []);

  useEffect(() => {
    getBiometricLockEnabled().then(value => {
      setEnabled(value);
      setLocked(value);
      setReady(true);
      if (value) void authenticate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') {
        wasBackgroundRef.current = true;
        setLocked(true);
      } else if (next === 'active' && wasBackgroundRef.current) {
        wasBackgroundRef.current = false;
        void authenticate();
      }
    });
    return () => sub.remove();
  }, [enabled, authenticate]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  if (enabled && locked) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-white px-8 dark:bg-neutral-950">
        <ShieldCheck size={40} color="#9ca3af" />
        <Text className="text-center text-sm text-neutral-500 dark:text-neutral-400">Re-Mail est verrouillé</Text>
        <Button onPress={() => void authenticate()}>Déverrouiller</Button>
      </View>
    );
  }

  return <>{children}</>;
}
