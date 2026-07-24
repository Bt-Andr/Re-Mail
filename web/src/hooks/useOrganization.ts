import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiClient'
import type { OrganizationStatus } from '../types/api'

export function useOrganization() {
  const [organization, setOrganization] = useState<OrganizationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/organizations/me')
      if (res.ok) setOrganization(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { organization, loading, refetch }
}
