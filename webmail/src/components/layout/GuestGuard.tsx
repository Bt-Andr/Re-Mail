import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../ui/Spinner'

// Empêche d'atteindre /login ou /signup avec une session déjà active. Ne redirige PAS
// tant qu'une intention "créer/rejoindre une entreprise" est en attente sur /welcome
// (voir SessionContext.pendingOrgIntent) : une identité personnelle vient d'être
// connectée, mais le sous-flux n'est pas terminé — rediriger ici couperait la reprise
// avant qu'elle n'ait pu s'exécuter.
export function GuestGuard() {
  const { user, loading, pendingOrgIntent } = useSession()
  if (loading) return <Spinner />
  if (user && !pendingOrgIntent) return <Navigate to="/inbox" replace />
  return <Outlet />
}
