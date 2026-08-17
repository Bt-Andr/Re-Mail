import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-amber-500 mb-3">
        <AlertTriangle size={32} />
      </div>
      <p className="text-sm font-medium text-foreground max-w-sm">{message || 'Impossible de charger ces données.'}</p>
      <div className="mt-4">
        <Button variant="secondary" onClick={onRetry}>
          Réessayer
        </Button>
      </div>
    </div>
  )
}
