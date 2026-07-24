import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import type { OrgRole } from '../../types/api'

export function RoleGuard({ allow }: { allow: OrgRole[] }) {
  const { user } = useSession()
  if (!user || !allow.includes(user.orgRole)) return <Navigate to="/inbox" replace />
  return <Outlet />
}
