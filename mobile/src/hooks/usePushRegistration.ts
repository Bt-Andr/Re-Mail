import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { registerDevice } from '../api/devices';

// Les notifications push distantes (remote) ont été retirées d'Expo Go à partir
// du SDK 53 — tenter d'utiliser expo-notifications dedans plante au chargement
// du module (import statique). On importe donc le module dynamiquement, et
// seulement en dehors d'Expo Go (build de dev/EAS ou standalone), pour que
// l'app reste utilisable sans notifications quand on teste via Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

// Enregistre le device auprès du backend (POST /api/devices) dès qu'une
// session est active, et redirige vers le thread concerné au tap sur la
// notification (data.threadId, poussé par src/helpers/thread.ts::notifyUser
// côté backend). Sans projectId EAS configuré (avant `eas init`), l'obtention
// du token échoue silencieusement — le reste de l'app continue de fonctionner.
export function usePushRegistration(enabled: boolean): void {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || registeredRef.current || isExpoGo) return;
    registeredRef.current = true;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

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
    if (isExpoGo) return;
    let subscription: { remove: () => void } | undefined;
    (async () => {
      const Notifications = await import('expo-notifications');
      subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const threadId = response.notification.request.content.data?.threadId;
        if (typeof threadId === 'string') {
          router.push(`/(app)/thread/${threadId}`);
        }
      });
    })();
    return () => subscription?.remove();
  }, []);
}
