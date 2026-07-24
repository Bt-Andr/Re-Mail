import { Inbox, Send } from 'lucide-react'

export type Folder = 'inbox' | 'sent'

export function FolderTabs({ folder, unreadCount, onChange }: { folder: Folder; unreadCount: number; onChange: (f: Folder) => void }) {
  const tabs: { id: Folder; label: string; icon: typeof Inbox }[] = [
    { id: 'inbox', label: 'Réception', icon: Inbox },
    { id: 'sent', label: 'Envoyés', icon: Send },
  ]
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            folder === t.id ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <t.icon size={12} />
          {t.label}
          {t.id === 'inbox' && unreadCount > 0 && (
            <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full font-bold leading-none">{unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}
