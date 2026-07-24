import { useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { formatFileSize } from '../../lib/format'

const MAX_FILES = 5
const MAX_SIZE = 10 * 1024 * 1024

export function AttachmentPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    const tooBig = picked.filter(f => f.size > MAX_SIZE)
    const valid = picked.filter(f => f.size <= MAX_SIZE)
    onChange([...files, ...valid].slice(0, MAX_FILES))
    e.target.value = ''
    if (tooBig.length) alert(`Fichier(s) trop volumineux (max 10 Mo) : ${tooBig.map(f => f.name).join(', ')}`)
  }

  return (
    <div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={pick} aria-label="Joindre des fichiers" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={files.length >= MAX_FILES}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors disabled:opacity-50"
      >
        <Paperclip size={14} />
        Joindre (max {MAX_FILES}, 10 Mo chacun)
      </button>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent border border-border text-xs text-foreground">
              <Paperclip size={11} />
              <span className="font-medium truncate max-w-[160px]">{f.name}</span>
              <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
              <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
