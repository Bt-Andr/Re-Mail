import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { ThemeToggle } from './components/ui/ThemeToggle'
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
import { OrgSettingsPage } from './features/settings/OrgSettingsPage'

export default function App() {
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
                  <Route path="/inbox" element={<InboxPage />}>
                    <Route index element={<InboxPlaceholder />} />
                    <Route path=":threadId" element={<ThreadDetailPane />} />
                  </Route>
                  <Route element={<RoleGuard allow={['OWNER', 'ADMIN']} />}>
                    <Route path="/mail-routes" element={<MailRoutesPage />} />
                    <Route path="/invites" element={<InvitesPage />} />
                    <Route path="/settings" element={<OrgSettingsPage />} />
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
