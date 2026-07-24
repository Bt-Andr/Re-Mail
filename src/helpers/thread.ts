import type { Organization, PrismaClient } from '@prisma/client'
import { buildResendClient } from '../lib/resendClient'
import { buildNotificationEmail, sendNotificationEmail } from '../lib/email'
import { sendPush } from '../lib/push'
import { getDecryptedResendKey } from './resendAccount'

export async function createActivity(
  db: PrismaClient,
  organizationId: string,
  threadId: string,
  userId: string | null,
  type: string,
  payload: Record<string, unknown> | null = null
): Promise<void> {
  try {
    await db.threadActivity.create({
      data: { organizationId, threadId, userId, type, payload: payload ? JSON.stringify(payload) : null },
    })
  } catch (e) {
    console.error('[ACTIVITY]', (e as Error).message)
  }
}

// Notifie un utilisateur (email + push) qu'un thread lui a été assigné ou a reçu
// un nouveau message. Best-effort : une notification ratée ne doit jamais faire
// échouer le traitement du thread/webhook qui l'a déclenchée.
export async function notifyUser(
  db: PrismaClient,
  org: Organization,
  userId: string,
  subject: string,
  title: string,
  rows: { label: string; value: string }[],
  pushBody: string,
  threadId: string
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (user?.email && org.resendApiKeyEnc && org.emailContact) {
    try {
      const resend = buildResendClient(getDecryptedResendKey(org))
      await sendNotificationEmail(
        resend,
        org.emailContact,
        org.companyName || org.name,
        user.email,
        subject,
        buildNotificationEmail(org.companyName || org.name, title, rows)
      )
    } catch (e) {
      console.error('[NOTIFY-EMAIL]', (e as Error).message)
    }
  }

  try {
    const tokens = await db.deviceToken.findMany({ where: { userId }, select: { expoPushToken: true } })
    await sendPush(
      tokens.map(t => ({ token: t.expoPushToken })),
      { title: subject, body: pushBody, data: { threadId } }
    )
  } catch (e) {
    console.error('[NOTIFY-PUSH]', (e as Error).message)
  }
}

interface CreateThreadInput {
  canal: string
  sujet: string
  externalFrom: string
  externalEmail: string
  bodyHtml: string
  sourceId?: string | null
  sourceType?: string | null
  toEmail?: string | null
}

export async function createThread(db: PrismaClient, org: Organization, input: CreateThreadInput) {
  const {
    canal,
    sujet,
    externalFrom,
    externalEmail,
    bodyHtml,
    sourceId = null,
    sourceType = null,
    toEmail = null,
  } = input

  const thread = await db.thread.create({
    data: {
      organizationId: org.id,
      canal,
      sujet,
      externalFrom,
      externalEmail,
      toEmail,
      status: 'nouveau',
      sourceId,
      sourceType,
      messages: {
        create: {
          organizationId: org.id,
          direction: 'inbound',
          fromName: externalFrom,
          fromEmail: externalEmail,
          body: bodyHtml,
        },
      },
    },
    include: { messages: { select: { id: true } } },
  })

  await createActivity(db, org.id, thread.id, null, 'created', { from: externalFrom, email: externalEmail })

  try {
    // findFirst (pas findUnique) : `canal` seul n'est plus une clé unique dans ce
    // schéma multi-tenant — l'unicité est composite ([organizationId, canal]), et
    // c'est le client scopé (forOrg) qui ajoute organizationId au where.
    const rule = await db.threadRoutingRule.findFirst({
      where: { canal },
      include: { assignTo: { select: { id: true, nom: true, email: true } } },
    })
    if (rule?.active && rule.assignTo) {
      await db.thread.update({ where: { id: thread.id }, data: { assignedToId: rule.assignTo.id } })
      ;(thread as { assignedToId: string | null }).assignedToId = rule.assignTo.id

      await createActivity(db, org.id, thread.id, null, 'assigned', { to: rule.assignTo.nom })

      await notifyUser(
        db,
        org,
        rule.assignTo.id,
        `Nouveau thread assigné — ${sujet}`,
        'Thread assigné automatiquement',
        [
          { label: 'Canal', value: canal },
          { label: 'De', value: `${externalFrom} <${externalEmail}>` },
          { label: 'Sujet', value: sujet },
        ],
        `${externalFrom}: ${sujet}`,
        thread.id
      )
    }
  } catch (e) {
    console.error('[AUTO-ROUTING]', (e as Error).message)
  }

  return thread
}
