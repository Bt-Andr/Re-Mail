import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { ExternalMailboxConnection, Organization, PrismaClient } from '@prisma/client'
import config from '../config'
import prisma from '../lib/prisma'
import { forOrg } from '../middleware/scopedPrisma'
import { getMailboxAuth } from '../lib/mailboxAuth'
import { createThread, createActivity, notifyUser, PERSONAL_MAILBOX_CANAL } from '../helpers/thread'
import { uploadBufferToCloudinary, buildOrgFolder, saveAttachmentRecords, StoredAttachment } from '../helpers/attachments'

let intervalHandle: NodeJS.Timeout | null = null

// Appelée une seule fois depuis src/server.ts — jamais depuis src/app.ts (c'est ce
// fichier que test/*.test.ts importe via supertest, donc les tests ne déclenchent
// jamais le poller par construction). Garde défensive en plus au cas où.
export function startMailboxPolling(): void {
  if (config.nodeEnv === 'test' || intervalHandle) return
  intervalHandle = setInterval(() => {
    pollAllMailboxes().catch(e => console.error('[MAILBOX-POLL]', (e as Error).message))
  }, config.mailboxPollIntervalMs)
}

export function stopMailboxPolling(): void {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
}

// Itère toutes les connexions actives, à travers TOUTES les organisations — requête
// légitimement cross-tenant au niveau système (même motif que processInboundEmail qui
// reçoit `org` en paramètre et scope ses écritures via forOrg(org.id) en interne).
// Traitement séquentiel, pas Promise.all, pour borner le nombre de connexions IMAP
// simultanées.
export async function pollAllMailboxes(): Promise<void> {
  const connections = await prisma.externalMailboxConnection.findMany({ where: { status: 'connected' } })
  for (const connection of connections) {
    try {
      await pollConnection(connection)
    } catch (e) {
      // Coupe-circuit : passe en erreur, le filtre status:'connected' ci-dessus l'exclut
      // de tous les cycles suivants jusqu'à un retry manuel (PATCH .../retry).
      console.error(`[MAILBOX-POLL] ${connection.id}`, (e as Error).message)
      await prisma.externalMailboxConnection
        .update({ where: { id: connection.id }, data: { status: 'error', lastError: (e as Error).message.slice(0, 500) } })
        .catch(() => {})
    }
  }
}

export async function pollConnection(connection: ExternalMailboxConnection): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: connection.organizationId } })
  if (!org) return

  const db = forOrg(connection.organizationId)
  const auth = await getMailboxAuth(connection)
  const client = new ImapFlow({
    host: connection.imapHost,
    port: connection.imapPort,
    secure: connection.imapSecure,
    auth,
    logger: false,
  })

  await client.connect()
  try {
    const box = await client.mailboxOpen('INBOX', { readOnly: true })

    // Renumérotage serveur (rare) : le curseur n'a plus de sens, on repart de 0.
    let lastSeenUid = connection.uidValidity != null && box.uidValidity !== connection.uidValidity ? 0 : connection.lastSeenUid

    if (box.uidNext - 1 > lastSeenUid) {
      for await (const message of client.fetch(`${lastSeenUid + 1}:*`, { source: true, uid: true }, { uid: true })) {
        if (message.uid <= lastSeenUid || !message.source) continue
        await processMessage(db, org, connection, message.source)
        lastSeenUid = Math.max(lastSeenUid, message.uid)
      }
    }

    await prisma.externalMailboxConnection.update({
      where: { id: connection.id },
      data: { lastSeenUid, uidValidity: box.uidValidity, lastPolledAt: new Date(), status: 'connected', lastError: null },
    })
  } finally {
    await client.logout().catch(() => client.close())
  }
}

export const HISTORY_IMPORT_MIN_DAYS = 1
export const HISTORY_IMPORT_MAX_DAYS = 90

// Import ponctuel de l'historique — jamais déclenché par le polling normal (qui ne
// regarde que du nouveau courrier au-delà de lastSeenUid, voir pollConnection). Borné
// dans le temps et silencieux (pas de notifyUser) : contrairement au polling normal,
// ceci peut créer/compléter beaucoup de threads d'un coup, jamais en une seule
// notification par message comme le veut l'utilisateur au fil de l'eau. lastSeenUid
// n'est jamais touché ici : les messages importés ont uid <= lastSeenUid par
// construction (voir filtre plus bas), donc hors de portée du polling normal — aucun
// risque de doublon entre les deux mécanismes.
export async function importMailboxHistory(connection: ExternalMailboxConnection, days: number): Promise<{ imported: number }> {
  if (connection.historyImportedAt) throw new Error('Historique déjà importé pour cette boîte.')

  const org = await prisma.organization.findUnique({ where: { id: connection.organizationId } })
  if (!org) throw new Error('Organisation introuvable.')

  const db = forOrg(connection.organizationId)
  const auth = await getMailboxAuth(connection)
  const client = new ImapFlow({
    host: connection.imapHost,
    port: connection.imapPort,
    secure: connection.imapSecure,
    auth,
    logger: false,
  })

  let imported = 0
  await client.connect()
  try {
    await client.mailboxOpen('INBOX', { readOnly: true })
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const uids = await client.search({ since }, { uid: true })
    // Ne traite que ce que le polling normal ne traitera jamais (uid <= lastSeenUid) —
    // le reste (courrier arrivé depuis la connexion) est déjà géré au fil de l'eau.
    const historicalUids = (Array.isArray(uids) ? uids : []).filter(uid => uid <= connection.lastSeenUid).sort((a, b) => a - b)

    for (const uid of historicalUids) {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!message || !message.source) continue
      await processMessage(db, org, connection, message.source, { silent: true })
      imported++
    }
  } finally {
    await client.logout().catch(() => client.close())
  }

  await prisma.externalMailboxConnection.update({ where: { id: connection.id }, data: { historyImportedAt: new Date() } })
  return { imported }
}

async function processMessage(
  db: PrismaClient,
  org: Organization,
  connection: ExternalMailboxConnection,
  source: Buffer,
  opts: { silent?: boolean } = {}
): Promise<void> {
  const parsed = await simpleParser(source)
  const fromAddr = (parsed.from?.value[0]?.address || '').toLowerCase() || 'inconnu@inconnu.invalid'
  const fromName = parsed.from?.value[0]?.name || fromAddr
  const subject = parsed.subject || '(Sans sujet)'
  const bodyHtml = parsed.html || `<p>${(parsed.text || '').replace(/\n/g, '<br>')}</p>`

  // Une connexion IMAP est la boîte perso d'UNE personne, pas un alias d'équipe routable
  // — canal fixe et réservé (voir PERSONAL_MAILBOX_CANAL), jamais de ThreadRoutingRule
  // dessus (createThread l'exclut explicitement, et routingRules.ts refuse de le créer).
  const canal = PERSONAL_MAILBOX_CANAL

  const stored: StoredAttachment[] = []
  for (const att of parsed.attachments) {
    const filename = att.filename || 'pièce-jointe'
    try {
      const uploaded = await uploadBufferToCloudinary(att.content, filename, att.contentType || null, buildOrgFolder(org.id))
      stored.push({ filename, contentType: att.contentType || null, size: att.size, url: uploaded.url, publicId: uploaded.publicId, contentId: att.cid || null })
    } catch (e) {
      console.error('[MAILBOX-POLL] pièce jointe:', (e as Error).message)
      stored.push({ filename, contentType: att.contentType || null, size: att.size, url: '', publicId: null, contentId: att.cid || null })
    }
  }

  const activeThread = await db.thread.findFirst({
    where: { externalEmail: fromAddr, canal, status: { not: 'resolu' } },
    orderBy: { createdAt: 'desc' },
  })

  if (activeThread) {
    const msg = await db.threadMessage.create({
      data: { organizationId: org.id, threadId: activeThread.id, direction: 'inbound', fromName, fromEmail: fromAddr, body: bodyHtml },
    })
    await saveAttachmentRecords(db, msg.id, stored)
    await db.thread.update({ where: { id: activeThread.id }, data: { updatedAt: new Date() } })
    if (!opts.silent) {
      await notifyUser(
        db,
        org,
        connection.userId,
        `Nouveau message — ${activeThread.sujet}`,
        'Nouveau message reçu',
        [{ label: 'De', value: `${fromName} <${fromAddr}>` }, { label: 'Sujet', value: activeThread.sujet }],
        `${fromName}: ${subject}`,
        activeThread.id
      )
    }
    return
  }

  const thread = await createThread(db, org, {
    canal,
    sujet: subject,
    externalFrom: fromName,
    externalEmail: fromAddr,
    bodyHtml,
    toEmail: connection.email,
    sourceType: connection.provider,
    sourceId: connection.id,
  })
  await db.thread.update({ where: { id: thread.id }, data: { assignedToId: connection.userId } })
  const owner = await db.user.findUnique({ where: { id: connection.userId }, select: { nom: true } })
  await createActivity(db, org.id, thread.id, null, 'assigned', { to: owner?.nom || connection.email })
  const firstMessageId = thread.messages?.[0]?.id
  if (firstMessageId) await saveAttachmentRecords(db, firstMessageId, stored)
}
