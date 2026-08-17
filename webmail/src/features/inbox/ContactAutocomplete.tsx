import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../lib/apiClient'
import { Input } from '../../components/ui/Input'
import type { Contact } from '../../types/api'

// Autocomplétion best-effort dérivée de l'historique des échanges (GET /contacts) —
// une erreur réseau ici ne doit jamais bloquer la saisie manuelle de l'adresse,
// contrairement aux autres appels apiFetch qui affichent l'erreur au champ.
export function ContactAutocomplete({
  label,
  value,
  onChange,
  readOnly,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  required?: boolean
}) {
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (readOnly || !value.trim()) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/contacts?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) setSuggestions(await res.json())
      } catch {
        // best-effort — voir commentaire en haut de fichier
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [value, readOnly])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const pick = (c: Contact) => {
    onChange(c.email)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        label={label}
        type="email"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        readOnly={readOnly}
        required={required}
        autoComplete="off"
      />
      {open && !readOnly && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-md text-sm">
          {suggestions.map(c => (
            <li key={c.email}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(c)}
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
              >
                {c.name ? <span className="font-medium text-foreground">{c.name} </span> : null}
                <span className="text-muted-foreground">{c.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
