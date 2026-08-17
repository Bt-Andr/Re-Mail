import { Archive, ArchiveRestore, Trash2, Undo2, X } from 'lucide-react'
import type { Folder } from './InboxPage'

export interface BulkPatch {
  status?: 'nouveau' | 'en_cours' | 'resolu'
  archivedAt?: boolean
  deletedAt?: boolean
}

const STATUS_OPTIONS: { value: BulkPatch['status']; label: string }[] = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'resolu', label: 'Résolu' },
]

// Remplace le bouton "Nouveau mail" + la barre de filtres pendant une sélection
// multiple — mêmes emplacements, même largeur, pour ne pas décaler la liste en
// dessous. Les actions proposées dépendent du dossier courant : on ne propose
// jamais une action qui ne changerait rien (ex. "Archiver" depuis la corbeille).
export function BulkActionBar({
  folder,
  count,
  onClear,
  onAction,
}: {
  folder: Folder
  count: number
  onClear: () => void
  onAction: (patch: BulkPatch) => void
}) {
  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClear} title="Désélectionner" className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors">
          <X size={15} />
        </button>
        <span className="text-sm font-medium text-foreground">{count} sélectionné{count > 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {folder !== 'trash' && (
          <>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onAction({ status: opt.value })}
                className="text-xs px-2 py-1 rounded-md border border-input bg-background hover:bg-accent transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {folder === 'trash' ? (
            <button
              type="button"
              onClick={() => onAction({ deletedAt: false })}
              title="Restaurer"
              className="p-1.5 rounded-md border border-input bg-background hover:bg-accent transition-colors"
            >
              <Undo2 size={14} />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onAction({ archivedAt: folder !== 'archive' })}
                title={folder === 'archive' ? 'Désarchiver' : 'Archiver'}
                className="p-1.5 rounded-md border border-input bg-background hover:bg-accent transition-colors"
              >
                {folder === 'archive' ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
              <button
                type="button"
                onClick={() => onAction({ deletedAt: true })}
                title="Mettre à la corbeille"
                className="p-1.5 rounded-md border border-input bg-background hover:bg-accent transition-colors text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
