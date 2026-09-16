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
