import type { PrismaClient } from '@prisma/client'
import prisma from '../lib/prisma'

// Modèles qui portent organizationId et doivent donc toujours être filtrés par
// tenant. ThreadAttachment est délibérément exclu : il n'a pas de organizationId
// propre (il dépend de ThreadMessage, déjà scopé), donc on ne peut pas l'y forcer —
// toute requête sur ThreadAttachment doit passer par messageId d'un message déjà
// chargé via un client scopé.
const SCOPED_MODELS = new Set([
  'User',
  'DeviceToken',
  'MailRoute',
  'MailDraft',
  'SenderGrant',
  'MailReplyToken',
  'Thread',
  'ThreadMessage',
  'ThreadRoutingRule',
  'ReplyTemplate',
  'ThreadActivity',
  'UserInvite',
  'ExternalMailboxConnection',
])

const READ_FILTER_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'])
const WRITE_FILTER_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany'])

// Client Prisma scopé à une organisation : toute requête sur un modèle
// multi-tenant reçoit automatiquement `where.organizationId` (lecture/update/delete)
// et `data.organizationId` (create) — un développeur qui oublie de filtrer par
// organisation ne peut donc pas faire fuiter les données d'un autre tenant.
//
// Nécessite Prisma >= 4.16 (extended `where` unique inputs), qui autorise des
// champs non-uniques additionnels dans le `where` d'un findUnique.
export function forOrg(organizationId: string): PrismaClient {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED_MODELS.has(model)) return query(args)

          const a = (args ?? {}) as Record<string, unknown>

          if (READ_FILTER_OPS.has(operation) || WRITE_FILTER_OPS.has(operation)) {
            a.where = { ...(a.where as object | undefined), organizationId }
          }

          if (operation === 'create') {
            a.data = { ...(a.data as object | undefined), organizationId }
          }

          if (operation === 'createMany') {
            const data = a.data
            a.data = Array.isArray(data)
              ? data.map(d => ({ ...d, organizationId }))
              : { ...(data as object | undefined), organizationId }
          }

          if (operation === 'upsert') {
            a.where = { ...(a.where as object | undefined), organizationId }
            a.create = { ...(a.create as object | undefined), organizationId }
          }

          return query(a)
        },
      },
    },
  }) as unknown as PrismaClient
}
