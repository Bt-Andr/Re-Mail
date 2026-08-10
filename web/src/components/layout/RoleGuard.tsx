import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import type { OrgRole } from '../../types/api'

// isPersonal exclut aussi un OWNER/ADMIN de son propre compte perso : ces rôles
// n'ont de sens que dans l'org invisible à un seul membre, jamais exposés comme
// des surfaces d'équipe (voir useAccountContext).
export function RoleGuard({ allow }: { allow: OrgRole[] }) {
  const { user, organization } = useSession()
  if (!user || !allow.includes(user.orgRole) || organization?.isPersonal) return <Navigate to="/inbox" replace />
  return <Outlet />
}
