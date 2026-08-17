import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../ui/Spinner'

// Empêche d'atteindre /login avec une session déjà active. Cette app (web/, admin)
// n'a que /login comme route publique — pas de /signup (la création d'org se fait
// exclusivement via le webmail) — donc le repli par défaut est /settings/organization,
// pas /inbox (route qui n'existe plus ici depuis la scission en deux apps).
export function GuestGuard() {
  const { user, loading } = useSession()
  if (loading) return <Spinner />
  if (user) return <Navigate to="/settings/organization" replace />
  return <Outlet />
}
