import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { useGlobalScrollFade } from './hooks/useGlobalScrollFade'
import { AuthGuard } from './components/layout/AuthGuard'
import { GuestGuard } from './components/layout/GuestGuard'
import { RoleGuard } from './components/layout/RoleGuard'
import { LoginPage } from './features/auth/LoginPage'
import { ProAddressesPage } from './features/proAddresses/ProAddressesPage'
import { MailRoutesPage } from './features/mailRoutes/MailRoutesPage'
import { InvitesPage } from './features/invites/InvitesPage'
import { UsersPage } from './features/users/UsersPage'
import { SettingsLayout } from './features/settings/SettingsLayout'
import { OrgSettingsPage } from './features/settings/OrgSettingsPage'

// App admin : réservée aux OWNER/ADMIN d'une organisation d'équipe existante — la
// messagerie (inbox/mailboxes/activate/signup) vit désormais dans webmail/, une SPA
// déployée séparément (voir RoleGuard pour le renvoi cross-app d'un MEMBER refusé ici).
export default function App() {
  useGlobalScrollFade()

  return (
    <ThemeProvider>
      <ThemeToggle className="fixed bottom-4 right-4 z-40" />
      <BrowserRouter>
        <ToastProvider>
          <SessionProvider>
            <Routes>
              <Route element={<GuestGuard />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route element={<AuthGuard />}>
                <Route element={<RoleGuard allow={['OWNER', 'ADMIN']} />}>
                  <Route path="/settings" element={<SettingsLayout />}>
                    <Route index element={<Navigate to="organization" replace />} />
                    <Route path="organization" element={<OrgSettingsPage />} />
                    <Route path="pro-addresses" element={<ProAddressesPage />} />
                    <Route path="mail-routes" element={<MailRoutesPage />} />
                    <Route path="invites" element={<InvitesPage />} />
                    <Route path="users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/settings/organization" replace />} />
            </Routes>
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
