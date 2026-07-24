import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-lg shadow-popover border border-border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button type="button" aria-label="Fermer" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border bg-muted/40 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}
