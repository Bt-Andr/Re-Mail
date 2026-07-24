import { useState } from 'react'
import { apiFetch } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import type { MailRouteBulkResult } from '../../types/api'

interface ParsedRow {
  alias: string
  personalEmail: string
  displayName: string
  valid: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Priorité à la configuration des alias : personalEmail est optionnel, ajoutable
// plus tard via "Modifier" — seul l'alias doit ressembler à une adresse valide.
function parseInput(raw: string): ParsedRow[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/[,\t;]+/).map(p => p.trim())
      const [alias = '', personalEmail = '', displayName = ''] = parts
      const valid = EMAIL_RE.test(alias) && (!personalEmail || EMAIL_RE.test(personalEmail))
      return { alias, personalEmail, displayName, valid }
    })
}

export function BulkImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<MailRouteBulkResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const rows = parseInput(raw)
  const validRows = rows.filter(r => r.valid)
  const invalidCount = rows.length - validRows.length

  const reset = () => {
    setRaw('')
    setResult(null)
    setError('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    if (validRows.length === 0) return
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/mail-routes/bulk', {
        method: 'POST',
        body: JSON.stringify({ routes: validRows.map(({ alias, personalEmail, displayName }) => ({ alias, personalEmail, displayName })) }),
      })
      if (!res.ok) {
        setError("Échec de l'import.")
        return
      }
      const data: MailRouteBulkResult = await res.json()
      setResult(data)
      if (data.created.length > 0) onImported()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Importer des adresses"
      onClose={close}
      footer={
        result ? (
          <Button onClick={close}>Fermer</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Annuler</Button>
            <Button onClick={submit} loading={loading} disabled={validRows.length === 0}>
              Importer{validRows.length > 0 ? ` (${validRows.length})` : ''}
            </Button>
          </>
        )
      }
    >
      {!result && (
        <>
          <p className="text-xs text-muted-foreground">
            Une adresse par ligne :{' '}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">alias@domaine.com, transfert@perso.com (optionnel), Nom affiché (optionnel)</code>.
            Vous pouvez coller directement depuis un tableur (Excel, Google Sheets) — seul l'alias est obligatoire, le reste peut être complété plus tard.
          </p>
          <Textarea
            rows={8}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={'contact@domaine.com\nrh@domaine.com, rh-perso@gmail.com\ncommercial@domaine.com, , Service Commercial'}
            className="font-mono text-xs"
          />
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {validRows.length} ligne{validRows.length > 1 ? 's' : ''} valide{validRows.length > 1 ? 's' : ''}
              {invalidCount > 0 && `, ${invalidCount} ignorée${invalidCount > 1 ? 's' : ''} (alias ou email mal formé)`}
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {result.created.length} adresse{result.created.length > 1 ? 's' : ''} importée{result.created.length > 1 ? 's' : ''}.
          </p>
          {result.skipped.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {result.skipped.length} ignorée{result.skipped.length > 1 ? 's' : ''} :
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto">
                {result.skipped.map((s, i) => (
                  <li key={i} className="font-mono">{s.alias} — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
