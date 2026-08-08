import { NavLink, Outlet, Link } from 'react-router-dom'
import { Inbox, Send, Trash2, Settings, LogOut, AlertTriangle } from 'lucide-react'
import { useSession } from '../../context/SessionContext'
import { useOrganization } from '../../hooks/useOrganization'
import { displayName } from '../../lib/session'

// Sidebar = uniquement la messagerie (comme Gmail : les dossiers sont la nav, pas
// une page "Boîte de réception" avec des onglets internes). L'administration
// (Adresses mail/Invitations/Utilisateurs/Organisation) est regroupée derrière
// l'icône Paramètres tout en bas, visible seulement OWNER/ADMIN — voir SettingsLayout.
const MAIL_ITEMS = [
  { to: '/inbox', label: 'Réception', icon: Inbox },
  { to: '/sent', label: 'Envoyés', icon: Send },
  { to: '/trash', label: 'Corbeille', icon: Trash2 },
]

function isManager(role?: string) {
  return role === 'OWNER' || role === 'ADMIN'
}

export function AppShell() {
  const { user, organization, logout } = useSession()
  const { organization: orgStatus, error: orgError, refetch: refetchOrgStatus } = useOrganization()

  const setupIncomplete = orgStatus && (!orgStatus.resendConnected || !orgStatus.webhookConfigured)

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-14 lg:w-60 flex-shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-3 lg:px-5 py-5 border-b border-border flex items-center gap-2.5 justify-center lg:justify-start">
          <img src="/web-app-manifest-192x192.png" alt="Re-Mail" className="w-8 h-8 rounded-md flex-shrink-0" />
          <span className="hidden lg:inline font-bold text-base tracking-tight">Re-Mail</span>
        </div>
        <div className="hidden lg:block px-5 py-3 border-b border-border">
          <p className="font-medium text-foreground text-sm truncate">{organization?.name ?? '...'}</p>
          <p className="text-xs text-muted-foreground truncate">{user ? displayName(user) : ''}</p>
        </div>
        <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1">
          {MAIL_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 text-base rounded-md transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'
                }`
              }
            >
              <item.icon size={20} />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-2 lg:px-3 py-4 border-t border-border space-y-1">
          {isManager(user?.orgRole) && (
            <NavLink
              to="/settings"
              title="Paramètres"
              className={({ isActive }) =>
                `flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 text-base rounded-md transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'
                }`
              }
            >
              <Settings size={20} />
              <span className="hidden lg:inline">Paramètres</span>
            </NavLink>
          )}
          <button
            type="button"
            onClick={logout}
            title="Déconnexion"
            className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 text-base font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors w-full"
          >
            <LogOut size={20} />
            <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {orgError && (
          <button
            type="button"
            onClick={() => void refetchOrgStatus()}
            className="flex items-center gap-2 px-5 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive hover:bg-destructive/15 transition-colors text-left"
          >
            <AlertTriangle size={14} className="flex-shrink-0" />
            {orgError} — cliquez pour réessayer.
          </button>
        )}
        {setupIncomplete && (
          <Link
            to="/onboarding"
            className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            <AlertTriangle size={14} className="flex-shrink-0" />
            Configuration incomplète — connectez votre compte Resend pour recevoir/envoyer des emails.
          </Link>
        )}
        <main className="flex-1 min-h-0 min-w-0 p-3 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
