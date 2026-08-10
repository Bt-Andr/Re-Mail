import { useSession } from '../context/SessionContext';

// isPersonal conditionne l'existence des surfaces d'équipe (nav Admin, invitations,
// vocabulaire "organisation") — un compte perso ne les voit jamais. isSoloTeam conditionne
// seulement le triage (statut, assignation) : s'applique aussi à une org pro qui n'a
// encore qu'un membre, sans lui retirer Réglages/Invitations pour autant.
export function useAccountContext() {
  const { user } = useSession();
  const isManager = user?.orgRole === 'OWNER' || user?.orgRole === 'ADMIN';
  const isPersonal = user?.organization?.isPersonal ?? false;
  const isSoloTeam = isPersonal || (user?.organization?.memberCount ?? 2) <= 1;

  return { isManager, isPersonal, isSoloTeam };
}
