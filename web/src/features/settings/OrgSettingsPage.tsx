import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { useOrganization } from '../../hooks/useOrganization'
import { useToast } from '../../context/ToastContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { CopyField } from '../../components/ui/CopyField'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export function OrgSettingsPage() {
  const { organization, loading, refetch } = useOrganization()
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', companyName: '', emailContact: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    if (organization) {
      setForm({ name: organization.name, companyName: organization.companyName ?? '', emailContact: organization.emailContact ?? '' })
    }
  }, [organization])

  if (loading || !organization) return <Spinner />

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await apiFetch('/organizations/me', { method: 'PUT', body: JSON.stringify(form) })
      if (!res.ok) {
        setError(await parseError(res, 'Enregistrement impossible.'))
        return
      }
      showToast('success', 'Organisation mise à jour.')
      void refetch()
    } finally {
      setSaving(false)
    }
  }

  const rotate = async () => {
    setRotating(true)
    try {
      const res = await apiFetch('/organizations/me/resend/regenerate-webhook-token', { method: 'POST' })
      if (res.ok) {
        showToast('success', "Nouvelle URL de webhook générée — mettez-la à jour dans Resend.")
        void refetch()
      } else {
        showToast('error', 'Rotation impossible.')
      }
    } finally {
      setRotating(false)
      setConfirmRotate(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Organisation</h1>
        <p className="text-sm text-muted-foreground">Informations générales et connexion Resend.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <Input label="Nom de l'organisation" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label="Nom affiché dans les emails" value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
        <Input label="Email de contact par défaut" type="email" value={form.emailContact} onChange={e => setForm(p => ({ ...p, emailContact: e.target.value }))} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={save} loading={saving}>Enregistrer</Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-sm font-semibold">Connexion Resend</h2>
        <p className="text-xs text-muted-foreground">
          {organization.resendConnected ? `Clé connectée (…${organization.resendApiKeyLast4})` : 'Non connecté'}
          {organization.resendVerifiedDomain && ` · Domaine : ${organization.resendVerifiedDomain}`}
        </p>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">URL du webhook</p>
          <CopyField value={organization.webhookUrl} />
        </div>
        <Button variant="secondary" onClick={() => setConfirmRotate(true)}>
          <RefreshCw size={14} />
          Régénérer l'URL du webhook
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRotate}
        title="Régénérer l'URL du webhook ?"
        message="L'ancienne URL cessera immédiatement de fonctionner. Vous devrez la remettre à jour dans votre dashboard Resend."
        danger
        confirmLabel="Régénérer"
        loading={rotating}
        onConfirm={rotate}
        onCancel={() => setConfirmRotate(false)}
      />
    </div>
  )
}