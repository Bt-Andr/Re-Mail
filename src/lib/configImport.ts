import { parseCsvSections, rowsToObjects } from './csv'

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
  mailRoutes: ImportedMailRoute[]
  routingRules: ImportedRoutingRule[]
  replyTemplates: ImportedReplyTemplate[]
}

function toBool(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false'
}

// Symétrique de la génération dans routes/organizations.ts (mêmes 4 sections,
// mêmes noms de colonnes) — voir docs/export-import-config-mail.md §2.
export function parseConfigImport(text: string): ParsedConfigImport {
  const sections = parseCsvSections(text)

  const domainRows = rowsToObjects(sections.get('Domaine'))
  const domain = domainRows[0]?.domain?.trim() || null

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
      canal: (r.canal || '').trim(),
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

  return { domain, mailRoutes, routingRules, replyTemplates }
}
