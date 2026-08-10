import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAccountContext } from './useAccountContext';

// Les écrans admin/* ne sont retirés du tiroir que pour les non-managers (voir
// DrawerContent) — expo-router n'a pas d'équivalent au RoleGuard web au niveau route,
// donc ce hook protège aussi contre la navigation directe (deep link, bouton retour).
export function useAdminGuard(): boolean {
  const { isManager, isPersonal } = useAccountContext();
  const allowed = isManager && !isPersonal;

  useEffect(() => {
    if (!allowed) router.replace('/(app)/(drawer)/inbox');
  }, [allowed]);

  return allowed;
}
