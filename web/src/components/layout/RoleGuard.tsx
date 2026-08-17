import { Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import type { OrgRole } from '../../types/api'

// isPersonal exclut aussi un OWNER/ADMIN de son propre compte perso : ces rôles
// n'ont de sens que dans l'org invisible à un seul membre, jamais exposés comme
// des surfaces d'équipe (voir useAccountContext côté webmail).
//
// Cette app (web/, admin) n'a plus de route /inbox depuis la scission en deux apps
// (voir plan "Scission de web/ en deux apps") : un membre refusé ici doit être
// renvoyé vers le webmail grand public, une SPA déployée séparément — React Router
// ne peut pas naviguer entre deux apps distinctes, d'où window.location.href plutôt
// qu'un <Navigate>.
export function RoleGuard({ allow }: { allow: OrgRole[] }) {
  const { user, organization } = useSession()
  if (!user || !allow.includes(user.orgRole) || organization?.isPersonal) {
    window.location.href = `${import.meta.env.VITE_WEBMAIL_URL}/inbox`
    return null
  }
  return <Outlet />
}
