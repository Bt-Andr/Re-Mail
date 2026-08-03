import { parseCsvSections, rowsToObjects } from './csv'

export interface ImportedUser {
  username: string
  email: string
  nom: string
  proEmail: string
  orgRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  isDeptHead: boolean
}

export interface ImportedMailRoute {
  alias: string
  personalEmail: string
  displayName: string
  active: boolean
}

export interface ImportedRoutingRule {
  canal: string
  assignToEmail: string
  active: boolean
}

export interface ImportedReplyTemplate {
  titre: string
  canal: string
  corps: string
}

export interface ParsedConfigImport {
  // Volontairement non appliqué automatiquement (voir docs/export-import-config-mail.md
  // §3) : un domaine différent entre source et cible casserait le routage. Renvoyé
  // uniquement à titre informatif pour l'écran de résultat.
  domain: string | null
  users: ImportedUser[]
  mailRoutes: ImportedMailRoute[]
  routingRules: ImportedRoutingRule[]
  replyTemplates: ImportedReplyTemplate[]
}

function toBool(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false'
}

function toOrgRole(value: string | undefined): 'OWNER' | 'ADMIN' | 'MEMBER' {
  const v = value?.trim().toUpperCase()
  return v === 'OWNER' || v === 'ADMIN' ? v : 'MEMBER'
}

// Symétrique de la génération dans routes/organizations.ts (mêmes 5 sections,
// mêmes noms de colonnes) — voir docs/export-import-config-mail.md §2.
export function parseConfigImport(text: string): ParsedConfigImport {
  const sections = parseCsvSections(text)

  const domainRows = rowsToObjects(sections.get('Domaine'))
  const domain = domainRows[0]?.domain?.trim() || null

  const users = rowsToObjects(sections.get('Users'))
    .map(r => ({
      username: (r.username || '').toLowerCase().trim(),
      email: (r.email || '').toLowerCase().trim(),
      nom: (r.nom || '').trim(),
      proEmail: (r.proEmail || '').trim(),
      orgRole: toOrgRole(r.orgRole),
      isDeptHead: r.isDeptHead?.trim().toLowerCase() === 'true',
    }))
    .filter(u => u.username && u.email && u.nom)

  const mailRoutes = rowsToObjects(sections.get('Mail Routes'))
    .map(r => ({
      alias: (r.alias || '').toLowerCase().trim(),
      personalEmail: (r.personalEmail || '').trim(),
      displayName: (r.displayName || '').trim(),
      active: toBool(r.active),
    }))
    .filter(r => r.alias)

  const routingRules = rowsToObjects(sections.get('Routing Rules'))
    .map(r => ({
      // Toujours en minuscule : le canal réel d'un thread est dérivé du local-part
      // de l'alias qui l'a reçu (toujours lowercase, voir routes/mail.ts) — une
      // règle créée avec une casse différente ne correspondrait jamais à un thread entrant.
      canal: (r.canal || '').trim().toLowerCase(),
      assignToEmail: (r.assignToEmail || '').trim().toLowerCase(),
      active: toBool(r.active),
    }))
    .filter(r => r.canal)

  const replyTemplates = rowsToObjects(sections.get('Reply Templates'))
    .map(r => ({
      titre: (r.titre || '').trim(),
      canal: (r.canal || '').trim(),
      corps: (r.corps || '').trim(),
    }))
    .filter(r => r.titre && r.corps)

  return { domain, users, mailRoutes, routingRules, replyTemplates }
}
