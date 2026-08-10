import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_LOCK_KEY = 'rmm_biometric_lock_enabled';

export async function getBiometricLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(BIOMETRIC_LOCK_KEY)) === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? 'true' : 'false');
}
