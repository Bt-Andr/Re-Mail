import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import type { ConfigImportResult } from '../../types/api'

export function ImportConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ConfigImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setFile(null)
    setResult(null)
    setError('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await apiFetch('/organizations/me/import', { method: 'POST', body })
      if (!res.ok) {
        setError(await parseError(res, "Échec de l'import."))
        return
      }
      setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Importer une configuration mail"
      onClose={close}
      footer={
        result ? (
          <Button onClick={close}>Fermer</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Annuler</Button>
            <Button onClick={submit} loading={loading} disabled={!file}>Importer</Button>
          </>
        )
      }
    >
      {!result && (
        <>
          <p className="text-xs text-muted-foreground">
            Fichier CSV produit par « Exporter en CSV » (ici ou dans une autre organisation de ce produit). Les adresses, règles de
            routage et modèles existants portant la même clé (alias / canal / titre) sont mis à jour ; les nouveaux sont créés.
            Rien n'est jamais supprimé. Le domaine du fichier est indicatif et n'est pas appliqué automatiquement.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <Upload size={15} />
            {file ? file.name : 'Choisir un fichier CSV…'}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
      {result && (
        <div className="space-y-4 text-sm">
          {result.domain && (
            <p className="text-xs text-muted-foreground">
              Domaine indiqué dans le fichier : <span className="font-mono">{result.domain}</span> — non appliqué, à reconfigurer via Connexion Resend si besoin.
            </p>
          )}

          <ImportSectionSummary label="Mail Routes" section={result.mailRoutes} itemLabel="alias" />
          <ImportSectionSummary label="Routing Rules" section={result.routingRules} itemLabel="canal" />

          <div>
            <p className="text-foreground">
              Reply Templates : {result.replyTemplates.created} créé{result.replyTemplates.created > 1 ? 's' : ''}, {result.replyTemplates.updated} mis à jour.
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ImportSectionSummary({
  label,
  section,
  itemLabel,
}: {
  label: string
  section: { created: number; updated: number; skipped: { key: string; reason: string }[] }
  itemLabel: string
}) {
  return (
    <div>
      <p className="text-foreground">
        {label} : {section.created} créé{section.created > 1 ? 's' : ''}, {section.updated} mis à jour
        {section.skipped.length > 0 && `, ${section.skipped.length} ignoré${section.skipped.length > 1 ? 's' : ''}`}.
      </p>
      {section.skipped.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto mt-1">
          {section.skipped.map((s, i) => (
            <li key={i} className="font-mono">{itemLabel} {s.key} — {s.reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
