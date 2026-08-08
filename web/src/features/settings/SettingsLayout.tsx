import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/settings/organization', label: 'Organisation' },
  { to: '/settings/mail-routes', label: 'Adresses mail' },
  { to: '/settings/invites', label: 'Invitations' },
  { to: '/settings/users', label: 'Utilisateurs' },
]

// Regroupe l'administration de l'organisation derrière un seul point d'entrée
// (icône Paramètres, voir AppShell) plutôt que des items de sidebar à plat au
// même niveau que la messagerie — cette page reste réservée OWNER/ADMIN (RoleGuard
// posé sur la route parente dans App.tsx).
export function SettingsLayout() {
  return (
    <div>
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
