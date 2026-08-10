export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type ThreadStatus = 'nouveau' | 'en_cours' | 'resolu';
export type ThreadFolder = 'inbox' | 'sent' | 'archive' | 'trash';
export type MessageDirection = 'inbound' | 'outbound';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  memberCount: number;
}

export interface User {
  id: string;
  username: string;
  nom: string;
  email: string;
  proEmail?: string | null;
  orgRole: OrgRole;
  isDeptHead?: boolean;
  organization?: Organization;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AssignedTo {
  id: string;
  nom: string;
  username: string;
}

export interface ThreadMessagePreview {
  id: string;
  direction: MessageDirection;
  fromName: string;
  body: string;
  sentAt: string;
  readAt: string | null;
}

export interface Thread {
  id: string;
  sujet: string;
  externalFrom: string;
  externalEmail: string;
  toEmail: string;
  canal: string;
  status: ThreadStatus;
  origin: MessageDirection;
  deletedAt: string | null;
  archivedAt: string | null;
  starred: boolean;
  assignedToId: string | null;
  assignedTo: AssignedTo | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: ThreadMessagePreview | null;
  unreadCount: number;
}

export interface ThreadAttachment {
  id: string;
  filename: string;
  contentType: string | null;
  size: number;
  url: string;
}

export interface ThreadMessage {
  id: string;
  direction: MessageDirection;
  fromName: string;
  fromEmail: string;
  toEmails: string | null;
  ccEmails: string | null;
  bccEmails: string | null;
  body: string;
  sentAt: string;
  readAt: string | null;
  sentBy: AssignedTo | null;
  attachments: ThreadAttachment[];
}

export interface ThreadDetail extends Omit<Thread, 'lastMessage' | 'unreadCount'> {
  messages: ThreadMessage[];
}

export type ThreadActivityType =
  | 'created'
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'replied'
  | 'sent'
  | 'forwarded'
  | 'trashed'
  | 'restored'
  | 'archived'
  | 'unarchived';

export interface ThreadActivity {
  id: string;
  type: ThreadActivityType;
  // JSON string encodé côté serveur (jamais pré-parsé) — voir helpers/thread.ts::createActivity.
  payload: string | null;
  createdAt: string;
  user: AssignedTo | null;
}

export interface Contact {
  email: string;
  name: string | null;
  lastUsed: string;
  count: number;
}

export interface SenderAddress {
  email: string;
  label: string;
  isDefault: boolean;
}

export interface ReplyPayload {
  to: string;
  subject: string;
  message: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
  draftId?: string;
  mode?: 'forward';
  sourceMessageId?: string;
  fromEmail?: string;
}

export interface ReplyResult {
  success: boolean;
  message: string;
  threadId: string | null;
}

export interface PickedAttachment {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

export interface InviteResolveResponse {
  fileToken: string;
  organizationName: string;
}

export interface InviteVerifyCodeResponse {
  activationToken: string;
  expiresAt: string;
}

export interface ApiErrorBody {
  error: string;
}

export interface MailRoute {
  id: string;
  alias: string;
  personalEmail: string;
  displayName: string | null;
  active: boolean;
}

export type InviteStatus = 'PENDING' | 'ACTIVATED' | 'REVOKED';

export interface UserInvite {
  id: string;
  username: string;
  email: string;
  nom: string;
  proEmail: string | null;
  orgRole: OrgRole;
  isDeptHead: boolean;
  status: InviteStatus;
  expiresAt: string;
  activationCodeExpiresAt: string | null;
  createdUserId: string | null;
  createdAt: string;
  // Présent uniquement sur la réponse de création (POST /user-invites) — signale si
  // l'email d'invitation a pu partir (org sans Resend connecté/emailContact : non envoyé,
  // l'invitation reste utilisable via Fichier + Code).
  emailSent?: boolean;
}

export interface SenderGrant {
  id: string;
  email: string;
}

export interface OrgUser {
  id: string;
  username: string;
  nom: string;
  email: string;
  orgRole: OrgRole;
  proEmail: string | null;
  isDeptHead: boolean;
  createdAt: string;
  senderGrants: SenderGrant[];
}

export interface MailDraft {
  id: string;
  toEmail: string;
  ccEmail: string;
  bccEmail: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReplyTemplate {
  id: string;
  titre: string;
  corps: string;
  canal: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  companyName: string | null;
  emailContact: string | null;
  resendConnected: boolean;
  resendApiKeyLast4: string | null;
  resendVerifiedDomain: string | null;
  webhookConfigured: boolean;
  webhookUrl: string;
  mailRoutesCount: number;
}
