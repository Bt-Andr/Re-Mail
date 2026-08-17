import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Mail, Check } from 'lucide-react'
import { useAccountSwitcher } from '../../context/AccountSwitcherContext'
import { useSession } from '../../context/SessionContext'
import { displayName } from '../../lib/session'

// N'apparaît que si l'utilisateur a plusieurs comptes distincts (boîtes externes +
// éventuellement l'organisation elle-même) — sinon aucun changement visuel par rapport
// à avant (juste le bloc org/utilisateur statique).
export function AccountSwitcher() {
  const { user, organization } = useSession()
  const { accounts, selectedAccountId, setSelectedAccountId } = useAccountSwitcher()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  if (accounts.length <= 1) {
    return (
      <div className="hidden lg:block px-5 py-3 border-b border-border">
        <p className="font-medium text-foreground text-sm truncate">{organization?.name ?? '...'}</p>
        <p className="text-xs text-muted-foreground truncate">{user ? displayName(user) : ''}</p>
      </div>
    )
  }

  const selected = accounts.find(a => a.id === selectedAccountId)

  return (
    <div ref={ref} className="hidden lg:block relative border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left hover:bg-accent transition-colors"
      >
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{selected ? selected.label : 'Toutes les boîtes'}</p>
          <p className="text-xs text-muted-foreground truncate">{organization?.name ?? ''}</p>
        </div>
        <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              setSelectedAccountId(null)
              setOpen(false)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
          >
            <Mail size={16} className="flex-shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">Toutes les boîtes</span>
            {!selectedAccountId && <Check size={14} className="flex-shrink-0" />}
          </button>
          {accounts.map(account => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                setSelectedAccountId(account.id)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
            >
              <Mail size={16} className="flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{account.label}</span>
              {account.status === 'error' && <span className="text-[10px] text-destructive flex-shrink-0">Erreur</span>}
              {selectedAccountId === account.id && <Check size={14} className="flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
