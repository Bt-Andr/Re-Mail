import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, X, Plus, User as UserIcon, Building2 } from 'lucide-react'
import { useSession } from '../../context/SessionContext'
import { displayName } from '../../lib/session'
import { AddAccountModal } from '../../features/auth/AddAccountModal'

// Sélecteur d'IDENTITÉ (perso + organisations connectées) — distinct du sélecteur de
// BOÎTES sous celui-ci (AccountSwitcher.tsx, qui filtre l'inbox par boîte externe au
// sein d'une même organisation). Changer d'organisation ici recharge la page (voir
// SessionContext.switchAccount) — le backend reste scopé à une organisation par
// requête, ce n'est pas un simple filtre côté client.
export function IdentitySwitcher() {
  const { accounts, activeAccountId, switchAccount, logout } = useSession()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const active = accounts.find(a => a.id === activeAccountId)

  const removeAccount = (id: string) => {
    const removingActive = id === activeAccountId
    const hadOthers = accounts.length > 1
    logout(id)
    if (removingActive && hadOthers) window.location.reload()
  }

  return (
    <div ref={ref} className="relative border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left hover:bg-accent transition-colors"
      >
        <div className="min-w-0 flex items-center gap-2">
          {active?.kind === 'org' ? <Building2 size={16} className="flex-shrink-0 text-muted-foreground" /> : <UserIcon size={16} className="flex-shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{active ? active.organization.name : '...'}</p>
            <p className="text-xs text-muted-foreground truncate">{active ? displayName(active.user) : ''}</p>
          </div>
        </div>
        {accounts.length > 1 && <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-lg py-1">
          {accounts.map(account => (
            <div key={account.id} className="flex items-center group">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (account.id !== activeAccountId) switchAccount(account.id)
                }}
                className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              >
                {account.kind === 'org' ? <Building2 size={14} className="flex-shrink-0 text-muted-foreground" /> : <UserIcon size={14} className="flex-shrink-0 text-muted-foreground" />}
                <span className="flex-1 min-w-0 truncate">{account.organization.name}</span>
                {account.id === activeAccountId && <Check size={14} className="flex-shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => removeAccount(account.id)}
                title="Déconnecter ce compte"
                className="px-2 py-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setAddOpen(true)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left border-t border-border mt-1 pt-2"
          >
            <Plus size={14} className="flex-shrink-0 text-muted-foreground" />
            <span>Ajouter un compte</span>
          </button>
        </div>
      )}
      <AddAccountModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
