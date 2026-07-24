import { ReactNode } from 'react'

const COLORS: Record<string, string> = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export function Badge({ color = 'gray', children }: { color?: keyof typeof COLORS; children: ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[color]}`}>{children}</span>
}

export function statusBadgeColor(status: string): keyof typeof COLORS {
  if (status === 'nouveau' || status === 'PENDING') return 'amber'
  if (status === 'en_cours') return 'blue'
  if (status === 'resolu' || status === 'ACTIVATED') return 'green'
  if (status === 'REVOKED') return 'red'
  return 'gray'
}
