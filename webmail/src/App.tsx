import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { AccountSwitcherProvider } from './context/AccountSwitcherContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { useGlobalScrollFade } from './hooks/useGlobalScrollFade'
import { AuthGuard } from './components/layout/AuthGuard'
import { GuestGuard } from './components/layout/GuestGuard'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { SignupPage } from './features/auth/SignupPage'
import { GoogleCallbackPage } from './features/auth/GoogleCallbackPage'
import { ActivatePage } from './features/activate/ActivatePage'
import { ExternalMailboxesPage } from './features/mailboxes/ExternalMailboxesPage'
import { InboxPage } from './features/inbox/InboxPage'
import { InboxPlaceholder } from './features/inbox/InboxPlaceholder'
import { ThreadDetailPane } from './features/inbox/ThreadDetailPane'

// App grand public : client mail classique multi-comptes. L'administration
// (organisation/routes/invitations/utilisateurs) vit désormais dans web/, une SPA
// admin déployée séparément, réservée OWNER/ADMIN — voir web/src/components/layout/RoleGuard.tsx
// pour le renvoi cross-app inverse.
export default function App() {
  useGlobalScrollFade()

  return (
    <ThemeProvider>
      <ThemeToggle className="fixed bottom-4 right-4 z-40" />
      <BrowserRouter>
        <ToastProvider>
          <SessionProvider>
            <AccountSwitcherProvider>
            <Routes>
              <Route path="/activate" element={<ActivatePage />} />
              <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

              <Route element={<GuestGuard />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>

              <Route element={<AuthGuard />}>
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
                  <Route path="/mailboxes" element={<ExternalMailboxesPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/inbox" replace />} />
            </Routes>
            </AccountSwitcherProvider>
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
