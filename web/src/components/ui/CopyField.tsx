import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyField({ value, large }: { value: string; large?: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <code className={`flex-1 px-3 py-2 bg-muted rounded-md font-mono text-foreground break-all ${large ? 'text-lg tracking-widest text-center' : 'text-xs'}`}>
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        title="Copier"
        className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
      >
        {copied ? <Check size={15} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={15} />}
      </button>
    </div>
  )
}
