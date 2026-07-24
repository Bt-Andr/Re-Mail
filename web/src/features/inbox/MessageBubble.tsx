import { Paperclip } from 'lucide-react'
import { formatDateTime, formatFileSize, initials } from '../../lib/format'
import type { ThreadMessage } from '../../types/api'

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
          dangerouslySetInnerHTML={{ __html: message.body }}
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
