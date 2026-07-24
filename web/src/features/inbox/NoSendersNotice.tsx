import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useSession } from '../../context/SessionContext'

export function NoSendersNotice() {
  const { user } = useSession()
  const isManager = user?.orgRole === 'OWNER' || user?.orgRole === 'ADMIN'

  return (
    <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
      <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={18} />
      <div className="text-sm text-amber-800 dark:text-amber-300">
        {isManager ? (
          <>
            Aucune adresse d'expédition disponible.{' '}
            <Link to="/onboarding" className="underline font-medium">Connectez Resend</Link> et{' '}
            <Link to="/mail-routes" className="underline font-medium">créez une adresse</Link> pour pouvoir écrire.
          </>
        ) : (
          "Aucune adresse d'expédition ne vous est attribuée. Demandez à un administrateur de vous en accorder une."
        )}
      </div>
    </div>
  )
}
