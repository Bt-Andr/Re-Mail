import { Search, X } from 'lucide-react'
import { Select } from '../../components/ui/Select'

interface FiltersBarProps {
  search: string
  onSearch: (v: string) => void
  status: string
  onStatus: (v: string) => void
}

export function FiltersBar({ search, onSearch, status, onStatus }: FiltersBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full pl-8 pr-8 py-1.5 text-sm border border-input rounded-md focus:ring-2 focus:ring-ring/30 focus:border-ring outline-none bg-card transition-colors"
        />
        {search && (
          <button type="button" title="Effacer" onClick={() => onSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
      </div>
      <Select aria-label="Filtrer par statut" value={status} onChange={e => onStatus(e.target.value)} className="text-xs">
        <option value="all">Tous les statuts</option>
        <option value="nouveau">Nouveau</option>
        <option value="en_cours">En cours</option>
        <option value="resolu">Résolu</option>
      </Select>
    </div>
  )
}
