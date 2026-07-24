import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getToken, registerUnauthorizedHandler } from '../lib/apiClient'
import { persistSession, clearSession } from '../lib/session'
import type { User, OrganizationSummary } from '../types/api'

interface SessionContextValue {
  user: User | null
  organization: OrganizationSummary | null
  loading: boolean
  login: (token: string, user: User, organization?: OrganizationSummary) => void
  logout: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setOrganization(null)
  }, [])

  const login = useCallback((token: string, nextUser: User, nextOrg?: OrganizationSummary) => {
    persistSession(token)
    setUser(nextUser)
    if (nextOrg) setOrganization(nextOrg)
  }, [])

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null)
      setOrganization(null)
      navigate('/login')
    })
  }, [navigate])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    apiFetch('/auth/me')
      .then(async res => {
        if (!res.ok) return clearSession()
        const data = await res.json()
        setUser(data.user)
        setOrganization(data.user.organization)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <SessionContext.Provider value={{ user, organization, loading, login, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
