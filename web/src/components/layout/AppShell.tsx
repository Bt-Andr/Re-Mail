import { NavLink, Outlet, Link } from 'react-router-dom'
import { Inbox, AtSign, UserPlus, Settings, LogOut, AlertTriangle, Mail } from 'lucide-react'
import { useSession } from '../../context/SessionContext'
import { useOrganization } from '../../hooks/useOrganization'
import { displayName } from '../../lib/session'
import type { OrgRole } from '../../types/api'

const NAV_ITEMS: { to: string; label: string; icon: typeof Inbox; roles: OrgRole[] }[] = [
  { to: '/inbox', label: 'Boîte de réception', icon: Inbox, roles: ['OWNER', 'ADMIN', 'MEMBER'] },
  { to: '/mail-routes', label: 'Adresses mail', icon: AtSign, roles: ['OWNER', 'ADMIN'] },
  { to: '/invites', label: 'Invitations', icon: UserPlus, roles: ['OWNER', 'ADMIN'] },
  { to: '/settings', label: 'Organisation', icon: Settings, roles: ['OWNER', 'ADMIN'] },
]

export function AppShell() {
  const { user, organization, logout } = useSession()
  const { organization: orgStatus } = useOrganization()

  const setupIncomplete = orgStatus && (!orgStatus.resendConnected || !orgStatus.webhookConfigured)

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 flex-shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary text-primary-foreground flex-shrink-0">
            <Mail size={13} strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-sm tracking-tight">Re-Mail</span>
        </div>
        <div className="px-5 py-3 border-b border-border">
          <p className="font-medium text-foreground text-sm truncate">{organization?.name ?? '...'}</p>
          <p className="text-xs text-muted-foreground truncate">{user ? displayName(user) : ''}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.filter(item => !user || item.roles.includes(user.orgRole)).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-border space-y-0.5">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors w-full"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {setupIncomplete && (
          <Link
            to="/onboarding"
            className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            <AlertTriangle size={14} className="flex-shrink-0" />
            Configuration incomplète — connectez votre compte Resend pour recevoir/envoyer des emails.
          </Link>
        )}
        <main className="flex-1 min-h-0 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
