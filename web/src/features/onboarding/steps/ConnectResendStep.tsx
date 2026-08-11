import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

export function ConnectResendStep({ onDone }: { onDone: (verifiedDomains: string[]) => void }) {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/organizations/me/resend/connect', { method: 'POST', body: JSON.stringify({ apiKey }) })
      if (!res.ok) {
        setError(await parseError(res, 'Clé API invalide.'))
        return
      }
      const data = await res.json()
      onDone(data.verifiedDomains as string[])
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-card border border-border rounded-lg p-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">1. Connecter votre compte Resend</h2>
        <p className="text-xs text-muted-foreground">Collez la clé API de votre compte Resend (resend.com/api-keys). Elle est chiffrée avant stockage.</p>
      </div>
      <Input label="Clé API Resend" placeholder="re_xxxxxxxxxxxx" value={apiKey} onChange={e => setApiKey(e.target.value)} autoFocus required />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" loading={loading} disabled={!apiKey.trim()}>Connecter</Button>
      <p className="text-xs text-muted-foreground text-center">
        Pas de domaine à vous ?{' '}
        <Link to="/mailboxes" className="text-foreground font-medium hover:underline">
          Connecter une boîte existante à la place
        </Link>
      </p>
    </form>
  )
}
