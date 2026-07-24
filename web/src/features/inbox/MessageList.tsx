import { MessageBubble } from './MessageBubble'
import type { ThreadMessage } from '../../types/api'

export function MessageList({ messages }: { messages: ThreadMessage[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {messages.map(m => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  )
}
