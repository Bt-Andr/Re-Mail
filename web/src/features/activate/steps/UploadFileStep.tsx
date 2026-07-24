import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { Button } from '../../../components/ui/Button'

export function UploadFileStep({ onResolved }: { onResolved: (fileToken: string, organizationName: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await apiFetch('/public/user-invites/resolve', { method: 'POST', body: form })
      if (!res.ok) {
        // Le backend ne distingue jamais introuvable/expiré/révoqué — on relaie tel quel.
        setError(await parseError(res, "Ce fichier d'activation n'est plus valide."))
        return
      }
      const data = await res.json()
      onResolved(data.fileToken, data.organizationName)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">1. Fichier d'activation</h2>
        <p className="text-xs text-muted-foreground">Le fichier que votre administrateur vous a transmis.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex flex-col items-center gap-2 border border-dashed border-border rounded-lg py-8 text-muted-foreground hover:border-ring hover:text-foreground transition-colors"
      >
        <Upload size={22} />
        <span className="text-sm">{file ? file.name : 'Choisir un fichier'}</span>
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={submit} loading={loading} disabled={!file} className="w-full">Continuer</Button>
    </div>
  )
}
