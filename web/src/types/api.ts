export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface User {
  id: string
  username: string
  nom: string
  email: string
  proEmail: string | null
  orgRole: OrgRole
  isDeptHead: boolean
  createdAt: string
  organization?: OrganizationSummary
}

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  isPersonal: boolean
  memberCount: number
}

export interface OrganizationStatus {
  id: string
  name: string
  slug: string
  companyName: string | null
  emailContact: string | null
  resendConnected: boolean
  resendApiKeyLast4: string | null
  resendVerifiedDomain: string | null
  webhookConfigured: boolean
  webhookUrl: string
  mailRoutesCount: number
  externalMailboxCount: number
  isPersonal: boolean
  memberCount: number
}

// Notion unifiée "compte" (voir src/routes/accounts.ts backend) — utilisée par le
// switcher (filtre l'inbox) et par le compositeur (adresse d'expédition par défaut).
export interface AccountSummary {
  id: string // ExternalMailboxConnection.id, ou le sentinel 'resend'
  kind: 'mailbox' | 'resend'
  provider: 'gmail' | 'imap' | 'resend'
  email: string
  label: string
  status: 'connected' | 'error' | null
}

export interface ExternalMailboxConnection {
  id: string
  provider: string
  email: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  status: 'connected' | 'error'
  lastError: string | null
  lastPolledAt: string | null
  createdAt: string
}

export interface MailRoute {
  id: string
  alias: string
  personalEmail: string
  displayName: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

// Une "adresse pro" côté produit EST une ThreadRoutingRule (canal → assignTo) — pas un
// modèle séparé. claimedAt distingue "attribuée par l'admin" de "connectée par la
// personne assignée depuis son picker" (voir routes/proAddresses.ts backend).
export interface ThreadRoutingRule {
  id: string
  canal: string
  active: boolean
  claimedAt: string | null
  assignTo: { id: string; nom: string; username: string; orgRole: OrgRole }
  createdAt: string
  updatedAt: string
}

// Réponse de PUT /thread-routing-rules/:canal quand assignToEmail ne correspond à aucun
// User existant mais à une UserInvite PENDING : aucune règle créée, juste mise en attente.
export interface StagedRoutingRule {
  staged: true
  canal: string
  invite: { id: string; email: string; nom: string }
}

export interface MailRouteBulkResult {
  created: MailRoute[]
  skipped: { alias: string; reason: string }[]
}

interface ImportSectionResult {
  created: number
  updated: number
  skipped: { key: string; reason: string }[]
}

export interface ConfigImportResult {
  domain: string | null
  users: { created: number; reused: number; skipped: { key: string; reason: string }[] }
  mailRoutes: ImportSectionResult
  routingRules: ImportSectionResult & { staged: number }
  replyTemplates: { created: number; updated: number }
}

export interface SenderAddress {
  email: string
  label: string
  isDefault: boolean
}

export interface Contact {
  email: string
  name: string | null
  lastUsed: string
  count: number
}

export interface ThreadListItem {
  id: string
  sujet: string
  externalFrom: string
  externalEmail: string
  toEmail: string | null
  canal: string
  status: 'nouveau' | 'en_cours' | 'resolu'
  origin: 'inbound' | 'outbound'
  deletedAt: string | null
  archivedAt: string | null
  starred: boolean
  assignedToId: string | null
  assignedTo: { id: string; nom: string; username: string } | null
  lastMessage: { id: string; direction: 'inbound' | 'outbound'; fromName: string; body: string; sentAt: string; readAt: string | null } | null
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export interface ThreadAttachment {
  id: string
  filename: string
  contentType: string | null
  size: number | null
  url: string
}

export interface ThreadMessage {
  id: string
  direction: 'inbound' | 'outbound'
  fromName: string
  fromEmail: string
  toEmails: string | null
  ccEmails: string | null
  bccEmails: string | null
  body: string
  sentBy: { id: string; nom: string; username: string } | null
  attachments: ThreadAttachment[]
  readAt: string | null
  sentAt: string
}

export interface ThreadDetail extends ThreadListItem {
  messages: ThreadMessage[]
}

export interface OrgUser {
  id: string
  username: string
  nom: string
  email: string
  orgRole: OrgRole
  proEmail: string | null
  isDeptHead: boolean
  createdAt: string
  senderGrants: { id: string; email: string }[]
}

export type InviteStatus = 'PENDING' | 'ACTIVATED' | 'REVOKED'

export interface UserInvite {
  id: string
  username: string
  email: string
  nom: string
  proEmail: string | null
  orgRole: OrgRole
  isDeptHead: boolean
  status: InviteStatus
  expiresAt: string
  activationCodeExpiresAt: string | null
  createdUserId: string | null
  createdAt: string
}

export interface LoginResponse {
  token: string
  user: User
}
