import { z } from 'zod'

export const MAX_EMAIL_LENGTH = 320
export const MAX_SUBJECT_LENGTH = 998
export const MAX_MESSAGE_LENGTH = 100_000
export const MAX_RESOURCE_ID_LENGTH = 128
export const MAX_RECIPIENTS = 20

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
