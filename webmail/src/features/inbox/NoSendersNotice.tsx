import { Link } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { Callout } from '../../components/ui/Callout'

export function NoSendersNotice() {
  const { user } = useSession()
  const isManager = user?.orgRole === 'OWNER' || user?.orgRole === 'ADMIN'

  return (
    <Callout>
      {isManager ? (
        <>
          Aucune adresse d'expédition disponible.{' '}
          <Link to="/mailboxes" className="underline font-medium">Connectez Resend</Link> et{' '}
          <a href={`${import.meta.env.VITE_ADMIN_URL}/settings/mail-routes`} className="underline font-medium">créez une adresse</a> pour pouvoir écrire.
        </>
      ) : (
        "Aucune adresse d'expédition ne vous est attribuée. Demandez à un administrateur de vous en accorder une."
      )}
    </Callout>
  )
}
