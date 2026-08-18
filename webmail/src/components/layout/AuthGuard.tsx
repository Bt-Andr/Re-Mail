import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../ui/Spinner'

export function AuthGuard() {
  const { user, loading } = useSession()
  if (loading) return <Spinner label="Vérification de la session…" />
  if (!user) return <Navigate to="/welcome" replace />
  return <Outlet />
}
