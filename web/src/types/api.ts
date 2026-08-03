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
}

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
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

export interface ThreadListItem {
  id: string
  sujet: string
  externalFrom: string
  externalEmail: string
  toEmail: string | null
  canal: string
  status: 'nouveau' | 'en_cours' | 'resolu'
  origin: 'inbound' | 'outbound'
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
