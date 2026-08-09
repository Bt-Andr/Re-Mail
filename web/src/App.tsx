import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { useGlobalScrollFade } from './hooks/useGlobalScrollFade'
import { AuthGuard } from './components/layout/AuthGuard'
import { GuestGuard } from './components/layout/GuestGuard'
import { RoleGuard } from './components/layout/RoleGuard'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { SignupPage } from './features/auth/SignupPage'
import { ActivatePage } from './features/activate/ActivatePage'
import { OnboardingWizard } from './features/onboarding/OnboardingWizard'
import { MailRoutesPage } from './features/mailRoutes/MailRoutesPage'
import { InboxPage } from './features/inbox/InboxPage'
import { InboxPlaceholder } from './features/inbox/InboxPlaceholder'
import { ThreadDetailPane } from './features/inbox/ThreadDetailPane'
import { InvitesPage } from './features/invites/InvitesPage'
import { UsersPage } from './features/users/UsersPage'
import { SettingsLayout } from './features/settings/SettingsLayout'
import { OrgSettingsPage } from './features/settings/OrgSettingsPage'

export default function App() {
  useGlobalScrollFade()

  return (
    <ThemeProvider>
      <ThemeToggle className="fixed bottom-4 right-4 z-40" />
      <BrowserRouter>
        <ToastProvider>
          <SessionProvider>
            <Routes>
              <Route path="/activate" element={<ActivatePage />} />

              <Route element={<GuestGuard />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>

              <Route element={<AuthGuard />}>
                <Route path="/onboarding" element={<OnboardingWizard />} />
                <Route element={<AppShell />}>
                  <Route path="/inbox" element={<InboxPage folder="inbox" />}>
                    <Route index element={<InboxPlaceholder />} />
                    <Route path=":threadId" element={<ThreadDetailPane />} />
                  </Route>
                  <Route path="/sent" element={<InboxPage folder="sent" />}>
                    <Route index element={<InboxPlaceholder />} />
                    <Route path=":threadId" element={<ThreadDetailPane />} />
                  </Route>
                  <Route path="/archive" element={<InboxPage folder="archive" />}>
                    <Route index element={<InboxPlaceholder />} />
                    <Route path=":threadId" element={<ThreadDetailPane />} />
                  </Route>
                  <Route path="/trash" element={<InboxPage folder="trash" />}>
                    <Route index element={<InboxPlaceholder />} />
                    <Route path=":threadId" element={<ThreadDetailPane />} />
                  </Route>
                  <Route element={<RoleGuard allow={['OWNER', 'ADMIN']} />}>
                    <Route path="/settings" element={<SettingsLayout />}>
                      <Route index element={<Navigate to="organization" replace />} />
                      <Route path="organization" element={<OrgSettingsPage />} />
                      <Route path="mail-routes" element={<MailRoutesPage />} />
                      <Route path="invites" element={<InvitesPage />} />
                      <Route path="users" element={<UsersPage />} />
                    </Route>
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/inbox" replace />} />
            </Routes>
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
