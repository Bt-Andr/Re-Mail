import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { registerDevice } from '../api/devices';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Enregistre le device auprès du backend (POST /api/devices) dès qu'une
// session est active, et redirige vers le thread concerné au tap sur la
// notification (data.threadId, poussé par src/helpers/thread.ts::notifyUser
// côté backend). Sans projectId EAS configuré (avant `eas init`), l'obtention
// du token échoue silencieusement — le reste de l'app continue de fonctionner.
export function usePushRegistration(enabled: boolean): void {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || registeredRef.current) return;
    registeredRef.current = true;

    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted') return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerDevice(expoPushToken);
      } catch (err) {
        console.warn('[push] enregistrement du device impossible', err);
      }
    })();
  }, [enabled]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const threadId = response.notification.request.content.data?.threadId;
      if (typeof threadId === 'string') {
        router.push(`/(app)/thread/${threadId}`);
      }
    });
    return () => subscription.remove();
  }, []);
}
