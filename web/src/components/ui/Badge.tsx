import { ReactNode } from 'react'
import { statusColors, type StatusKey } from '@re-mail/design-tokens'

// Couleurs génériques (rôles utilisateur, statut de connexion boîte externe...) — pas
// que des statuts de thread/invitation, donc pas remplaçables par les tokens partagés
// (qui ne modélisent que le mapping statut→couleur, voir statusBadgeColor ci-dessous).
const COLORS: Record<string, string> = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

// `@re-mail/design-tokens` nomme cette famille "emerald" (teinte Tailwind), ce composant
// la nomme "green" (nom générique déjà utilisé par les appelants non liés au statut,
// voir UsersPage/ExternalMailboxesPage) — seule traduction nécessaire entre les deux.
const FAMILY_TO_COLOR: Record<string, keyof typeof COLORS> = {
  amber: 'amber',
  blue: 'blue',
  emerald: 'green',
  red: 'red',
}

export function Badge({ color = 'gray', children }: { color?: keyof typeof COLORS; children: ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[color]}`}>{children}</span>
}

// Mapping statut→couleur canonique : source unique dans @re-mail/design-tokens
// (partagée avec mobile), plus de duplication locale de la logique nouveau/en_cours/resolu.
export function statusBadgeColor(status: string): keyof typeof COLORS {
  const token = statusColors[status as StatusKey]
  return token ? FAMILY_TO_COLOR[token.family] : 'gray'
}
