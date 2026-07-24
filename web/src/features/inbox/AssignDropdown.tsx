import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiClient'
import type { OrgUser } from '../../types/api'

export function AssignDropdown({ assignedToId, onAssign }: { assignedToId: string | null; onAssign: (userId: string | null) => void }) {
  const [users, setUsers] = useState<OrgUser[]>([])

  useEffect(() => {
    apiFetch('/users').then(async res => {
      if (res.ok) setUsers(await res.json())
    })
  }, [])

  return (
    <select
      aria-label="Assigner à"
      value={assignedToId ?? ''}
      onChange={e => onAssign(e.target.value || null)}
      className="text-xs border border-input rounded-md px-2 py-1.5 bg-card text-foreground focus:ring-2 focus:ring-ring/30 outline-none"
    >
      <option value="">— Non assigné —</option>
      {users.map(u => (
        <option key={u.id} value={u.id}>{u.nom}</option>
      ))}
    </select>
  )
}
