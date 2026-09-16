import { z } from 'zod'

export const MAX_EMAIL_LENGTH = 320
export const MAX_SUBJECT_LENGTH = 998
export const MAX_MESSAGE_LENGTH = 100_000
export const MAX_RESOURCE_ID_LENGTH = 128
export const MAX_RECIPIENTS = 20
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 1_024

export const resourceIdSchema = z
  .string({ required_error: 'Identifiant requis.', invalid_type_error: 'Identifiant invalide.' })
  .trim()
  .min(1, 'Identifiant invalide.')
  .max(MAX_RESOURCE_ID_LENGTH, 'Identifiant invalide.')

export const emailAddressSchema = z
  .string({ required_error: 'Adresse email requise.', invalid_type_error: 'Adresse email invalide.' })
  .trim()
  .max(MAX_EMAIL_LENGTH, 'Adresse email invalide.')
  .email('Adresse email invalide.')

export const passwordSchema = z
  .string({ required_error: 'Mot de passe requis.', invalid_type_error: 'Le mot de passe doit être textuel.' })
  .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)
  .max(MAX_PASSWORD_LENGTH, 'Le mot de passe est trop long.')

const loginPasswordSchema = z
  .string({ required_error: 'Identifiants requis.', invalid_type_error: 'Identifiants requis.' })
  .min(1, 'Identifiants requis.')
  .max(MAX_PASSWORD_LENGTH, 'Identifiants invalides.')

const usernameSchema = z
  .string({ required_error: "Nom d'utilisateur requis.", invalid_type_error: "Nom d'utilisateur invalide." })
  .trim()
  .min(1, "Nom d'utilisateur requis.")
  .max(64, "Le nom d'utilisateur est trop long.")
  .transform(value => value.toLowerCase())

const personNameSchema = z
  .string({ required_error: 'Nom requis.', invalid_type_error: 'Nom invalide.' })
  .trim()
  .min(1, 'Nom requis.')
  .max(160, 'Le nom est trop long.')

export const normalizedEmailSchema = emailAddressSchema.transform(value => value.toLowerCase())
const optionalEmailSchema = z.union([normalizedEmailSchema, z.literal(''), z.null()]).optional()
const orgRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER'])
const grantedSendersSchema = z.array(normalizedEmailSchema).max(100, 'Trop d’adresses autorisées.').optional()

export const signupSchema = z
  .object({
    accountType: z.enum(['perso', 'pro']).optional(),
    orgName: z.string().trim().min(1).max(160, "Le nom de l'organisation est trop long.").optional(),
    username: usernameSchema,
    email: normalizedEmailSchema,
    password: passwordSchema,
    nom: personNameSchema,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.accountType !== 'perso' && !value.orgName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Champs requis manquants.' })
    }
  })

export const loginSchema = z.object({
  username: usernameSchema,
  password: loginPasswordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: loginPasswordSchema,
  newPassword: passwordSchema,
})

export const passwordResetRequestSchema = z.object({
  username: usernameSchema,
})

export const passwordResetConfirmSchema = z.object({
  token: z.string({ required_error: 'Token requis.', invalid_type_error: 'Token invalide.' }).trim().min(32, 'Token invalide.').max(512, 'Token invalide.'),
  newPassword: passwordSchema,
})

export const googleExchangeSchema = z.object({
  handoff: resourceIdSchema,
})

export const userCreateSchema = z
  .object({
    username: usernameSchema,
    nom: personNameSchema,
    email: normalizedEmailSchema,
    password: passwordSchema,
    orgRole: orgRoleSchema.optional(),
    proEmail: optionalEmailSchema,
    isDeptHead: z.boolean().optional(),
    grantedSenders: grantedSendersSchema,
  })
  .passthrough()

export const userUpdateSchema = z
  .object({
    nom: personNameSchema.optional(),
    username: usernameSchema.optional(),
    email: normalizedEmailSchema.optional(),
    orgRole: orgRoleSchema.optional(),
    proEmail: optionalEmailSchema,
    password: z.union([z.literal(''), passwordSchema]).optional(),
    isDeptHead: z.boolean().optional(),
    grantedSenders: grantedSendersSchema,
  })
  .passthrough()
  .refine(
    value =>
      value.nom !== undefined ||
      value.username !== undefined ||
      value.email !== undefined ||
      value.orgRole !== undefined ||
      value.proEmail !== undefined ||
      value.password !== undefined ||
      value.isDeptHead !== undefined ||
      value.grantedSenders !== undefined,
    { message: 'Aucune modification demandée.' }
  )

export const senderGrantCreateSchema = z.object({
  email: normalizedEmailSchema,
})

export const userInviteCreateSchema = z
  .object({
    username: usernameSchema,
    email: normalizedEmailSchema,
    nom: personNameSchema,
    proEmail: optionalEmailSchema,
    orgRole: orgRoleSchema.optional(),
    isDeptHead: z.boolean().optional(),
  })
  .passthrough()

const inviteTokenSchema = z.string().trim().min(1, 'Token requis.').max(512, 'Token invalide.')

export const inviteTokenQuerySchema = z.object({
  token: inviteTokenSchema,
})

export const inviteCodeVerificationSchema = z.object({
  fileToken: inviteTokenSchema,
  code: z
    .string({ required_error: 'fileToken et code requis.', invalid_type_error: 'Code invalide.' })
    .trim()
    .min(1, 'fileToken et code requis.')
    .max(32, 'Code invalide.')
    .transform(value => value.toUpperCase()),
})

export const inviteActivationSchema = z.object({
  fileToken: inviteTokenSchema,
  activationToken: inviteTokenSchema,
  password: passwordSchema,
})

export const domainNameSchema = z
  .string({ required_error: 'Domaine requis.', invalid_type_error: 'Domaine invalide.' })
  .trim()
  .toLowerCase()
  .max(253, 'Domaine invalide.')
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    'Domaine invalide.'
  )

export const resendConnectSchema = z.object({
  apiKey: z
    .string({ required_error: 'apiKey requis.', invalid_type_error: 'apiKey invalide.' })
    .trim()
    .min(1, 'apiKey requis.')
    .max(512, 'apiKey invalide.'),
})

export const resendDomainSelectionSchema = z.object({
  domain: domainNameSchema,
})

export const webhookSecretSchema = z
  .string({ required_error: 'webhookSecret requis.', invalid_type_error: 'webhookSecret invalide.' })
  .trim()
  .min(1, 'webhookSecret requis.')
  .max(512, 'webhookSecret invalide.')
  .regex(/^whsec_[A-Za-z0-9+/_-]{16,}={0,2}$/, 'Secret webhook Resend invalide.')

export const resendWebhookSecretSchema = z.object({
  webhookSecret: webhookSecretSchema,
})

const mailRouteFields = {
  alias: normalizedEmailSchema,
  personalEmail: z.union([normalizedEmailSchema, z.literal('')]).optional(),
  displayName: z.string().trim().max(160, 'Le nom affiché est trop long.').optional(),
  active: z.boolean().optional(),
}

export const mailRouteCreateSchema = z.object(mailRouteFields)

export const mailRouteUpdateSchema = z
  .object({
    alias: mailRouteFields.alias.optional(),
    personalEmail: mailRouteFields.personalEmail,
    displayName: mailRouteFields.displayName,
    active: mailRouteFields.active,
  })
  .refine(value => Object.values(value).some(item => item !== undefined), { message: 'Aucune modification demandée.' })

export const mailRouteBulkSchema = z.object({
  routes: z.array(z.unknown(), { required_error: 'routes requis.', invalid_type_error: 'routes requis.' }).min(1, 'routes requis.').max(200, '200 adresses maximum par import.'),
})

export function emailBelongsToDomain(email: string, domain: string): boolean {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase() === domain.toLowerCase()
}

const nullableTrimmedText = (max: number, message: string) =>
  z.union([z.string().trim().max(max, message), z.null()]).optional()

export const organizationUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom de l'organisation est requis.").max(160, "Le nom de l'organisation est trop long.").optional(),
    companyName: nullableTrimmedText(160, 'Le nom affiché est trop long.'),
    emailContact: z.union([normalizedEmailSchema, z.literal(''), z.null()]).optional(),
  })
  .refine(value => Object.values(value).some(item => item !== undefined), { message: 'Aucune modification demandée.' })

const routingCanalSchema = z
  .string({ required_error: 'Canal requis.', invalid_type_error: 'Canal invalide.' })
  .trim()
  .toLowerCase()
  .min(1, 'Canal requis.')
  .max(128, 'Canal invalide.')
  .regex(/^[^\s@]+$/, 'Canal invalide.')

export const routingCanalParamSchema = z.object({ canal: routingCanalSchema })

export const routingRuleUpsertSchema = z
  .object({
    canal: routingCanalSchema,
    assignToId: resourceIdSchema.optional(),
    assignToEmail: normalizedEmailSchema.optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.assignToId ? 1 : 0) + (value.assignToEmail ? 1 : 0) !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Indiquez soit assignToId, soit assignToEmail.' })
    }
  })

export const replyTemplateQuerySchema = z.object({
  canal: routingCanalSchema.optional(),
})

export const replyTemplateWriteSchema = z.object({
  titre: z.string({ required_error: 'Titre et corps requis.', invalid_type_error: 'Titre invalide.' }).trim().min(1, 'Titre et corps requis.').max(200, 'Le titre est trop long.'),
  corps: z.string({ required_error: 'Titre et corps requis.', invalid_type_error: 'Corps invalide.' }).trim().min(1, 'Titre et corps requis.').max(MAX_MESSAGE_LENGTH, 'Le corps est trop long.'),
  canal: z.union([routingCanalSchema, z.literal(''), z.null()]).optional(),
})

const draftFields = {
  toEmail: z.string().max(2_000, 'Le champ destinataire est trop long.'),
  ccEmail: z.string().max(2_000, 'Le champ copie est trop long.'),
  bccEmail: z.string().max(2_000, 'Le champ copie cachée est trop long.'),
  subject: z.string().max(MAX_SUBJECT_LENGTH, 'Le sujet est trop long.'),
  body: z.string().max(MAX_MESSAGE_LENGTH, 'Le corps est trop long.'),
}

export const draftCreateSchema = z.object({
  toEmail: draftFields.toEmail.optional().default(''),
  ccEmail: draftFields.ccEmail.optional().default(''),
  bccEmail: draftFields.bccEmail.optional().default(''),
  subject: draftFields.subject.optional().default(''),
  body: draftFields.body.optional().default(''),
})

export const draftUpdateSchema = z
  .object({
    toEmail: draftFields.toEmail.optional(),
    ccEmail: draftFields.ccEmail.optional(),
    bccEmail: draftFields.bccEmail.optional(),
    subject: draftFields.subject.optional(),
    body: draftFields.body.optional(),
  })
  .refine(value => Object.values(value).some(item => item !== undefined), { message: 'Aucune modification demandée.' })

const expoPushTokenSchema = z
  .string({ required_error: 'expoPushToken requis.', invalid_type_error: 'expoPushToken invalide.' })
  .trim()
  .min(1, 'expoPushToken requis.')
  .max(512, 'expoPushToken invalide.')

export const deviceRegistrationSchema = z.object({
  expoPushToken: expoPushTokenSchema,
  platform: z.string().trim().min(1).max(32).regex(/^[a-z0-9_-]+$/i, 'Plateforme invalide.').optional().default('unknown'),
})

export const deviceTokenParamSchema = z.object({
  expoPushToken: expoPushTokenSchema,
})

function isBlockedMailboxHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match) return false
  const octets = match.slice(1).map(Number)
  if (octets.some(octet => octet > 255)) return true
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

const mailboxHostSchema = z
  .string({ required_error: 'Serveur requis.', invalid_type_error: 'Serveur invalide.' })
  .trim()
  .toLowerCase()
  .min(1, 'Serveur requis.')
  .max(253, 'Serveur invalide.')
  .regex(
    /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|(?:\d{1,3}\.){3}\d{1,3})$/,
    'Serveur invalide.'
  )
  .refine(host => !isBlockedMailboxHost(host), 'Les serveurs locaux ou privés ne sont pas autorisés.')

const mailboxPortSchema = z
  .number({ required_error: 'Port requis.', invalid_type_error: 'Port invalide.' })
  .int('Port invalide.')
  .min(1, 'Port invalide.')
  .max(65_535, 'Port invalide.')

export const mailboxCredentialsSchema = z.object({
  email: normalizedEmailSchema,
  imapHost: mailboxHostSchema,
  imapPort: mailboxPortSchema,
  imapSecure: z.boolean().optional().default(true),
  smtpHost: mailboxHostSchema,
  smtpPort: mailboxPortSchema,
  smtpSecure: z.boolean().optional().default(true),
  password: z.string({ required_error: 'Mot de passe requis.', invalid_type_error: 'Mot de passe invalide.' }).min(1, 'Mot de passe requis.').max(MAX_PASSWORD_LENGTH, 'Mot de passe invalide.'),
})

export const mailboxConnectionIdParamSchema = z.object({ id: resourceIdSchema })

export const mailboxHistoryImportSchema = z.object({
  days: z
    .number({ invalid_type_error: 'Le nombre de jours doit être numérique.' })
    .optional()
    .default(30)
    .transform(days => Math.min(Math.max(Math.round(days), 1), 90)),
})

const emailListSchema = z
  .string({ invalid_type_error: 'Liste de destinataires invalide.' })
  .optional()
  .transform(value => {
    if (!value?.trim()) return []
    return [...new Set(
      value
        .split(',')
        .map(item => item.trim())
        .filter(item => emailAddressSchema.safeParse(item).success)
    )].slice(0, MAX_RECIPIENTS)
  })

export const emailReplySchema = z
  .object({
    to: emailAddressSchema,
    cc: emailListSchema,
    bcc: emailListSchema,
    subject: z
      .string({ invalid_type_error: 'Le sujet doit être textuel.' })
      .max(MAX_SUBJECT_LENGTH, 'Le sujet est trop long.')
      .default(''),
    message: z
      .string({ required_error: 'Le corps du message est requis.', invalid_type_error: 'Le corps du message doit être textuel.' })
      .max(MAX_MESSAGE_LENGTH, 'Le corps du message est trop long.')
      .refine(value => value.trim().length > 0, 'Le corps du message est requis.'),
    threadId: resourceIdSchema.optional(),
    draftId: resourceIdSchema.optional(),
    sourceMessageId: resourceIdSchema.optional(),
    mode: z.enum(['new', 'reply', 'forward'], { invalid_type_error: 'Mode d’envoi invalide.' }).optional(),
    fromEmail: emailAddressSchema.optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.mode === 'forward' && (!value.threadId || !value.sourceMessageId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'threadId et sourceMessageId requis pour un transfert.',
      })
    }
  })

const boundedIntegerQuery = (name: string, min: number, max: number) =>
  z
    .string({ invalid_type_error: `${name} doit être un entier compris entre ${min} et ${max}.` })
    .regex(/^\d+$/, `${name} doit être un entier compris entre ${min} et ${max}.`)
    .transform(Number)
    .refine(value => value >= min && value <= max, `${name} doit être un entier compris entre ${min} et ${max}.`)
    .optional()

export const threadListQuerySchema = z
  .object({
    canal: z.string().trim().min(1).max(128).optional(),
    status: z.enum(['nouveau', 'en_cours', 'resolu']).optional(),
    folder: z.enum(['inbox', 'sent', 'archive', 'trash']).optional(),
    q: z.string().trim().max(500, 'Recherche trop longue.').optional(),
    take: boundedIntegerQuery('take', 1, 100),
    skip: boundedIntegerQuery('skip', 0, 100_000),
    account: z.union([z.literal('resend'), resourceIdSchema]).optional(),
  })
  .passthrough()

export const threadAssignmentSchema = z.object({
  assignedToId: z.union([resourceIdSchema, z.null()]),
})

export const threadStatusSchema = z.object({
  status: z.enum(['nouveau', 'en_cours', 'resolu'], { invalid_type_error: 'Statut invalide.' }),
})

export const threadStarSchema = z.object({
  starred: z.boolean({ required_error: 'starred (boolean) requis.', invalid_type_error: 'starred (boolean) requis.' }),
})

export const threadBulkActionSchema = z
  .object({
    ids: z
      .array(resourceIdSchema, { required_error: 'ids (tableau non vide) requis.', invalid_type_error: 'ids (tableau non vide) requis.' })
      .min(1, 'ids (tableau non vide) requis.')
      .max(200, 'Trop de fils sélectionnés (200 maximum).'),
    status: z.enum(['nouveau', 'en_cours', 'resolu'], { invalid_type_error: 'Statut invalide.' }).optional(),
    archivedAt: z.boolean().optional(),
    deletedAt: z.boolean().optional(),
  })
  .refine(value => value.status !== undefined || value.archivedAt !== undefined || value.deletedAt !== undefined, {
    message: 'Aucune modification demandée.',
  })
