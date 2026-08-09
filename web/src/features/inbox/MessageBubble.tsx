import DOMPurify from 'dompurify'
import { Paperclip } from 'lucide-react'
import { formatDateTime, formatFileSize, initials } from '../../lib/format'
import type { ThreadMessage } from '../../types/api'

// Le corps d'un message vient d'un expéditeur externe non fiable (email entrant) —
// on ne le rend jamais tel quel : DOMPurify retire scripts/handlers/balises dangereuses
// avant dangerouslySetInnerHTML. target="_blank" forcé sur les liens pour éviter le
// reverse tabnabbing (window.opener) sur du HTML qu'on ne contrôle pas.
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'], FORBID_TAGS: ['form', 'input', 'button'] })
}

export function MessageBubble({ message }: { message: ThreadMessage }) {
  const isOut = message.direction === 'outbound'
  const displayName = isOut ? message.sentBy?.nom ?? message.fromName : message.fromName

  return (
    <div className={`flex gap-3 ${isOut ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${isOut ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {initials(displayName)}
      </div>
      <div className={`flex-1 min-w-0 ${isOut ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isOut ? 'justify-end' : ''}`}>
          <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground">{formatDateTime(message.sentAt)}</span>
        </div>
        <div
          className={`inline-block text-left text-sm rounded-lg px-4 py-3 max-w-full prose-sm ${isOut ? 'bg-accent text-foreground' : 'bg-muted text-foreground'}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body) }}
          onErrorCapture={e => {
            // Image distante indisponible (réseau, hotlink-protection, URL expirée...) :
            // masquer plutôt que d'afficher l'icône "image cassée" du navigateur.
            const target = e.target as HTMLElement
            if (target.tagName === 'IMG') target.style.display = 'none'
          }}
        />
        {message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mt-2 ${isOut ? 'justify-end' : ''}`}>
            {message.attachments.map(a => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
              >
                <Paperclip size={11} />
                {a.filename}
                <span className="text-muted-foreground/80">{formatFileSize(a.size)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
