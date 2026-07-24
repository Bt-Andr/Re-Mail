import { FormEvent, useState } from 'react'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

interface VerifyCodeStepProps {
  fileToken: string
  organizationName: string
  onVerified: (activationToken: string) => void
}

export function VerifyCodeStep({ fileToken, organizationName, onVerified }: VerifyCodeStepProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/public/user-invites/verify-code', { method: 'POST', body: JSON.stringify({ fileToken, code }) })
      if (!res.ok) {
        setError(await parseError(res, 'Code incorrect. Après plusieurs essais, demandez un nouveau code à votre administrateur.'))
        return
      }
      const data = await res.json()
      onVerified(data.activationToken)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">2. Code d'activation</h2>
        <p className="text-xs text-muted-foreground">
          Connecté à <strong className="text-foreground">{organizationName}</strong>. Contactez votre administrateur pour obtenir le code (transmis séparément du fichier).
        </p>
      </div>
      <Input
        label="Code"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="XXXXXXXX"
        className="font-mono tracking-widest text-center text-lg"
        maxLength={8}
        autoFocus
        required
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" loading={loading} disabled={code.length < 4} className="w-full">Vérifier</Button>
    </form>
  )
}
