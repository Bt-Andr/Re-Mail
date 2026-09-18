import type { Organization } from '@prisma/client'
import { forOrg } from '../middleware/scopedPrisma'
import { buildResendClient } from '../lib/resendClient'
import { getDecryptedResendKey } from '../helpers/resendAccount'
import { extractEmail, stripQuotedText } from '../helpers/inbound'
import { createThread, notifyUser } from '../helpers/thread'
import { findCorrelatedThread, getEmailHeader, normalizeMessageId, parseMessageIdList } from '../helpers/threadCorrelation'
import {
  fetchInboundAttachments,
  uploadInboundAttachments,
  saveAttachmentRecords,
  replaceCidReferences,
  toResendAttachments,
  type ResendAttachment,
  type StoredAttachment,
} from '../helpers/attachments'

/**
 * Traite un email Resend déjà persisté dans la file entrante.
 *
 * Ce service ne dépend ni d'Express ni du cycle de vie HTTP : le webhook et le
 * worker de reprise peuvent donc exécuter exactement le même traitement métier.
 */
export async function processInboundEmail(org: Organization, payload: unknown, inboundEventId?: string): Promise<void> {
  const db = forOrg(org.id)
  if (inboundEventId) {
    const alreadyProcessed = await db.threadMessage.findFirst({ where: { inboundEventId }, select: { id: true } })
    if (alreadyProcessed) return
  }
  const resendApiKey = getDecryptedResendKey(org)
  const resend = buildResendClient(resendApiKey)

  const body = payload as { data?: Record<string, unknown> } & Record<string, unknown>
  const data = (body?.data ?? body) as Record<string, unknown>
  const toRaw = Array.isArray(data.to) ? (data.to as string[])[0] : (data.to as string) || ''
  const fromRaw = Array.isArray(data.from) ? (data.from as string[])[0] : (data.from as string) || ''
  const toAddr = extractEmail(toRaw)
  const fromAddr = extractEmail(fromRaw)
  const subject = (data.subject as string) || '(Sans sujet)'
  const emailId = data.email_id as string | undefined
  let internetMessageId = normalizeMessageId(data.message_id)
  let inReplyTo = normalizeMessageId(getEmailHeader(data.headers, 'in-reply-to'))
  let references = parseMessageIdList(getEmailHeader(data.headers, 'references'))

  console.log(`[INBOUND] Org ${org.id} : de=${fromRaw} -> à=${toAddr} (id=${emailId})`)

  let htmlBody = ''
  let textBody = ''
  if (emailId) {
    try {
      const emailRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      })
      if (emailRes.ok) {
        const emailData = (await emailRes.json()) as {
          html?: string
          text?: string
          message_id?: string
          headers?: Record<string, unknown>
        }
        htmlBody = emailData.html || ''
        textBody = emailData.text || ''
        internetMessageId = normalizeMessageId(emailData.message_id) ?? internetMessageId
        inReplyTo = normalizeMessageId(getEmailHeader(emailData.headers, 'in-reply-to')) ?? inReplyTo
        const fetchedReferences = parseMessageIdList(getEmailHeader(emailData.headers, 'references'))
        if (fetchedReferences.length) references = fetchedReferences
      } else {
        console.warn(`[INBOUND] Corps impossible à récupérer (${emailRes.status})`)
      }
    } catch (e) {
      console.error('[INBOUND] Fetch corps email :', (e as Error).message)
    }
  }

  let inboundAttachments: ResendAttachment[] = []
  let storedAttachments: StoredAttachment[] = []
  if (emailId) {
    inboundAttachments = await fetchInboundAttachments(emailId, resendApiKey)
    if (inboundAttachments.length) {
      storedAttachments = await uploadInboundAttachments(inboundAttachments, org.id)
    }
  }

  const nameMatchRaw = fromRaw.match(/^"?([^"<]+)"?\s*</)
  const senderName = nameMatchRaw ? nameMatchRaw[1].trim() : fromAddr

  const replyMatch = toAddr.match(/^reply\+([a-z0-9-]+)@/i)
  if (replyMatch) {
    const token = replyMatch[1]
    const replyToken = await db.mailReplyToken.findUnique({
      where: { token },
      include: { thread: { select: { id: true, assignedTo: { select: { id: true, email: true, nom: true } } } } },
    })

    if (!replyToken || replyToken.expiresAt < new Date()) {
      console.warn(`[INBOUND-REPLY] Org ${org.id} : token expiré/introuvable : ${token}`)
      return
    }

    await db.mailReplyToken.update({ where: { token }, data: { expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } }).catch(() => {})

    const cleanHtml = replaceCidReferences(
      htmlBody || `<p>${stripQuotedText(textBody).replace(/\n/g, '<br>')}</p>`,
      storedAttachments
    )

    if (replyToken.purpose !== 'conversation') {
      let clientReplyTo = replyToken.aliasFrom
      try {
        const nextToken = await db.mailReplyToken.create({
          data: {
            organizationId: org.id,
            aliasFrom: replyToken.aliasFrom,
            externalTo: replyToken.externalTo,
            externalCc: replyToken.externalCc,
            externalBcc: replyToken.externalBcc,
            subject: replyToken.subject || subject,
            purpose: replyToken.purpose,
            threadId: replyToken.threadId,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        })
        const domain = replyToken.aliasFrom.split('@')[1]
        clientReplyTo = `reply+${nextToken.token}@${domain}`
      } catch (e) {
        console.error('[INBOUND-REPLY] next token:', (e as Error).message)
      }

      const relayed = await resend.emails.send({
        from: `${org.companyName || org.name} <${replyToken.aliasFrom}>`,
        replyTo: clientReplyTo,
        to: replyToken.externalTo,
        cc: replyToken.externalCc ? replyToken.externalCc.split(',') : undefined,
        bcc: replyToken.externalBcc ? replyToken.externalBcc.split(',') : undefined,
        subject: /^re:/i.test(subject) ? subject : `Re: ${replyToken.subject || subject}`,
        html: cleanHtml,
        attachments: toResendAttachments(inboundAttachments),
      })
      if (relayed.error) throw new Error(relayed.error.message)
      console.log(`[INBOUND-REPLY] Org ${org.id} : ${replyToken.aliasFrom} -> ${replyToken.externalTo}`)
    }

    if (replyToken.threadId) {
      try {
        const msg = await db.threadMessage.create({
          data: {
            organizationId: org.id,
            threadId: replyToken.threadId,
            direction: 'inbound',
            fromName: senderName,
            fromEmail: fromAddr,
            body: cleanHtml,
            inboundEventId,
            internetMessageId,
            inReplyTo,
            references,
          },
        })
        await saveAttachmentRecords(db, msg.id, storedAttachments)
      } catch (e) {
        console.error('[INBOUND-REPLY] threadMessage:', (e as Error).message)
      }

      if (replyToken.thread?.assignedTo) {
        await notifyUser(
          db,
          org,
          replyToken.thread.assignedTo.id,
          `Réponse reçue — ${replyToken.subject || subject}`,
          'Nouvelle réponse externe',
          [
            { label: 'De', value: `${senderName} <${fromAddr}>` },
            { label: 'Sujet', value: replyToken.subject || subject },
          ],
          `${senderName}: ${stripQuotedText(textBody).slice(0, 120)}`,
          replyToken.threadId
        )
      }
    }
    return
  }

  const canal = toAddr.split('@')[0].toLowerCase()
  const inboundHtml = replaceCidReferences(
    htmlBody || `<p>${textBody.replace(/\n/g, '<br>')}</p>`,
    storedAttachments
  )

  const correlatedThread = await findCorrelatedThread(db, {
    externalEmail: fromAddr,
    canal,
    sourceId: null,
    subject,
    inReplyTo,
    references,
  })
  const activeThread = correlatedThread
    ? await db.thread.findUnique({
        where: { id: correlatedThread.id },
        include: { assignedTo: { select: { id: true, email: true, nom: true } } },
      })
    : null

  let threadId: string
  if (activeThread) {
    const msg = await db.threadMessage.create({
      data: {
        organizationId: org.id,
        threadId: activeThread.id,
        direction: 'inbound',
        fromName: senderName,
        fromEmail: fromAddr,
        body: inboundHtml,
        inboundEventId,
        internetMessageId,
        inReplyTo,
        references,
      },
    })
    await saveAttachmentRecords(db, msg.id, storedAttachments)
    await db.thread.update({ where: { id: activeThread.id }, data: { updatedAt: new Date() } })
    console.log(`[INBOUND] Org ${org.id} : message ajouté au thread existant ${activeThread.id}`)

    if (activeThread.assignedTo) {
      await notifyUser(
        db,
        org,
        activeThread.assignedTo.id,
        `Nouveau message — ${subject}`,
        'Nouveau message reçu',
        [
          { label: 'De', value: `${senderName} <${fromAddr}>` },
          { label: 'Sujet', value: subject },
        ],
        `${senderName}: ${stripQuotedText(textBody).slice(0, 120)}`,
        activeThread.id
      )
    }
    threadId = activeThread.id
  } else {
    const newThread = await createThread(db, org, {
      canal,
      sujet: subject,
      externalFrom: senderName,
      externalEmail: fromAddr,
      toEmail: toAddr,
      bodyHtml: inboundHtml,
      inboundEventId,
      internetMessageId,
      inReplyTo,
      references,
    })
    const firstMessageId = newThread.messages?.[0]?.id
    if (firstMessageId) await saveAttachmentRecords(db, firstMessageId, storedAttachments)
    threadId = newThread.id
    console.log(`[INBOUND] Org ${org.id} : nouveau thread créé ${threadId}`)
  }

  const route = await db.mailRoute.findFirst({ where: { alias: toAddr, active: true } })
  if (!route?.personalEmail.trim()) {
    console.log(`[INBOUND] Org ${org.id} : pas de transfert personnel pour ${toAddr} — thread créé uniquement`)
    return
  }

  const inboundToken = await db.mailReplyToken.create({
    data: {
      organizationId: org.id,
      aliasFrom: route.alias,
      externalTo: fromAddr,
      subject,
      purpose: 'forward_bridge',
      threadId,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  })
  const domain = route.alias.split('@')[1]
  const replyToAddr = `reply+${inboundToken.token}@${domain}`
  const senderDisplay = route.displayName
    ? `${route.displayName} · ${org.companyName || org.name} <${route.alias}>`
    : `${org.companyName || org.name} <${route.alias}>`

  await resend.emails.send({
    from: senderDisplay,
    replyTo: replyToAddr,
    to: route.personalEmail,
    subject,
    html: inboundHtml,
    attachments: toResendAttachments(inboundAttachments),
    headers: { 'X-Original-From': fromRaw, 'X-Forwarded-To': route.alias },
  })
  console.log(`[INBOUND] Org ${org.id} : transféré ${fromAddr} -> ${route.alias} -> ${route.personalEmail}`)
}
