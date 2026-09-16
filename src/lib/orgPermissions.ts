import type { OrgRole } from '@prisma/client'

// Matrice de gouvernance des comptes :
// - OWNER gère les ADMIN/MEMBER ; le rôle OWNER passe uniquement par le transfert.
// - ADMIN gère uniquement les MEMBER.
// - MEMBER ne gère aucun compte.
export function canCreateOrgRole(actorRole: OrgRole, requestedRole: OrgRole): boolean {
  if (requestedRole === 'OWNER') return false
  if (actorRole === 'OWNER') return true
  return actorRole === 'ADMIN' && requestedRole === 'MEMBER'
}

export function canManageOrgUser(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (actorRole === 'OWNER') return true
  return actorRole === 'ADMIN' && targetRole === 'MEMBER'
}

export function canSetOrgRole(actorRole: OrgRole, targetRole: OrgRole, requestedRole: OrgRole): boolean {
  if (!canManageOrgUser(actorRole, targetRole)) return false
  if (requestedRole === 'OWNER') return false
  if (actorRole === 'ADMIN') return requestedRole === 'MEMBER'
  return true
}
