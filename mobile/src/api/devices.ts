import { apiFetch } from './client';
import { Platform } from 'react-native';

export function registerDevice(expoPushToken: string): Promise<unknown> {
  return apiFetch('/devices', {
    method: 'POST',
    body: { expoPushToken, platform: Platform.OS },
  });
}

export function unregisterDevice(expoPushToken: string): Promise<unknown> {
  return apiFetch(`/devices/${encodeURIComponent(expoPushToken)}`, { method: 'DELETE' });
}
