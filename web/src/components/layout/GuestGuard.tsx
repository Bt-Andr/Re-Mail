import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../ui/Spinner'

// Empêche d'atteindre /login ou /signup avec une session déjà active.
export function GuestGuard() {
  const { user, loading } = useSession()
  if (loading) return <Spinner />
  if (user) return <Navigate to="/inbox" replace />
  return <Outlet />
}
