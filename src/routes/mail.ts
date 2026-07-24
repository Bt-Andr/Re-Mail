import { Router } from 'express'
import type { Organization } from '@prisma/client'
import prisma from '../lib/prisma'
import { forOrg } from '../middleware/scopedPrisma'
import { authenticateToken } from '../middleware/auth'
import { attachmentUpload } from '../lib/upload'
import { buildResendClient } from '../lib/resendClient'
import { getDecryptedResendKey, getDecryptedWebhookSecret } from '../helpers/resendAccount'
import { verifyResendWebhook } from '../helpers/webhookSignature'
import { extractEmail, stripQuotedText } from '../helpers/inbound'
import { getAllowedSenders } from '../helpers/senders'
import { createActivity, createThread, notifyUser } from '../helpers/thread'
import {
  fetchInboundAttachments,
  uploadInboundAttachments,
  saveAttachmentRecords,
  replaceCidReferences,
  toResendAttachments,
  storedToResendAttachments,
  uploadBufferToCloudinary,
  buildOrgFolder,
  MAX_ATTACHMENT_BYTES,
  ResendAttachment,
  StoredAttachment,
} from '../helpers/attachments'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RECIPIENTS = 20

function parseEmailList(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  return [...new Set(
    raw.split(',').map(s => s.trim()).filter(s => EMAIL_RE.test(s))
  )].slice(0, MAX_RECIPIENTS)
}

// GET /api/emails/senders — adresses d'expédition autorisées pour l'utilisateur
// connecté (utilisé par le composeur pour peupler/valider le champ "De").
router.get('/emails/senders', authenticateToken, async (req, res) => {
  res.json(await getAllowedSenders(forOrg(req.user!.organizationId), req.user!.id))
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/emails/reply — envoie une réponse, un nouveau mail, ou un transfert
// (accepte JSON ou multipart avec fichiers dans le champ "attachments")
// ─────────────────────────────────────────────────────────────────────────
router.post('/emails/reply', authenticateToken, attachmentUpload.array('attachments', 5), async (req, res) => {
  const { to, subject, message, threadId, draftId, mode, sourceMessageId } = req.body
  const cc = parseEmailList(req.body.cc)
  const bcc = parseEmailList(req.body.bcc)
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const isForward = mode === 'forward'

  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org?.resendApiKeyEnc) return res.status(400).json({ error: 'Aucun compte Resend connecté pour cette organisation.' })

  const db = forOrg(req.user!.organizationId)
  const allowed = await getAllowedSenders(db, req.user!.id)
  let fromEmail = ''
  let senderName = org.companyName || org.name

  if (isForward && (!threadId || !sourceMessageId)) {
    return res.status(400).json({ error: 'threadId et sourceMessageId requis pour un transfert.' })
  }

  if (threadId) {
    // Une réponse (ou un transfert) part obligatoirement de l'adresse qui a reçu le mail
    let receivedOn: string | null = null
    try {
      const thread = await db.thread.findUnique({ where: { id: threadId }, select: { toEmail: true } })
      receivedOn = thread?.toEmail ?? null
    } catch (e) {
      console.error('[REPLY] Thread lookup:', (e as Error).message)
    }
    if (receivedOn) {
      const match = allowed.find(s => s.email.toLowerCase() === receivedOn!.toLowerCase())
      if (!match) return res.status(403).json({ error: `Vous n'êtes pas autorisé à envoyer depuis ${receivedOn}.` })
      fromEmail = match.email
      senderName = match.label
      try {
        const route = await db.mailRoute.findFirst({ where: { alias: receivedOn, active: true } })
        if (route?.displayName) senderName = `${route.displayName} · ${org.companyName || org.name}`
      } catch (e) {
        console.error('[REPLY] MailRoute lookup:', (e as Error).message)
      }
    }
  }

  if (!fromEmail) {
    const requestedFrom = typeof req.body.fromEmail === 'string' ? req.body.fromEmail.trim().toLowerCase() : ''
    const match = requestedFrom
      ? allowed.find(s => s.email.toLowerCase() === requestedFrom)
      : allowed.find(s => s.isDefault) ?? allowed[0]
    if (!match) {
      return res.status(403).json({
        error: requestedFrom ? "Adresse d'expédition non autorisée." : "Aucune adresse d'expédition ne vous est attribuée. Contactez un administrateur.",
      })
    }
    fromEmail = match.email
    senderName = match.label
  }

  const resend = buildResendClient(getDecryptedResendKey(org))

  // Nouveau mail (ou fil sans adresse de réception) : crée un fil « Envoyés »
  let effectiveThreadId: string | null = threadId || null
  let createdThreadId: string | null = null
  if (!effectiveThreadId) {
    try {
      const newThread = await db.thread.create({
        data: {
          organizationId: org.id,
          canal: 'email',
          sujet: subject || '(Sans sujet)',
          externalFrom: to,
          externalEmail: to,
          toEmail: fromEmail,
          origin: 'outbound',
          status: 'en_cours',
          assignedToId: req.user!.id,
        },
      })
      effectiveThreadId = newThread.id
      createdThreadId = newThread.id
    } catch (e) {
      console.error('[SEND] Création thread sortant:', (e as Error).message)
    }
  }

  let replyToAddr = fromEmail
  if (effectiveThreadId) {
    try {
      const replyToken = await db.mailReplyToken.create({
        data: {
          organizationId: org.id,
          aliasFrom: fromEmail,
          externalTo: to,
          externalCc: cc.length ? cc.join(',') : null,
          externalBcc: bcc.length ? bcc.join(',') : null,
          subject,
          threadId: effectiveThreadId,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })
      const domain = fromEmail.split('@')[1]
      replyToAddr = `reply+${replyToken.token}@${domain}`
    } catch (e) {
      console.error('[REPLY-TOKEN]', (e as Error).message)
    }
  }

  // Transfert : réutilise le corps + les pièces jointes déjà stockées (Cloudinary) du
  // message d'origine, pas besoin de re-télécharger quoi que ce soit depuis Resend.
  let html = `<p>${message.replace(/\n/g, '<br/>')}</p>`
  let forwardAttachments: ReturnType<typeof storedToResendAttachments> | undefined
  if (isForward) {
    const source = await db.threadMessage.findUnique({
      where: { id: sourceMessageId },
      include: { attachments: true },
    })
    if (!source || source.threadId !== effectiveThreadId) {
      return res.status(404).json({ error: 'Message à transférer introuvable.' })
    }
    html = `${html}
      <hr/>
      <p>---------- Message transféré ----------<br/>
      De : ${source.fromName} &lt;${source.fromEmail}&gt;<br/>
      Date : ${source.sentAt.toISOString()}<br/>
      Objet : ${subject}</p>
      ${source.body}`
    forwardAttachments = storedToResendAttachments(
      source.attachments.map(a => ({ filename: a.filename, contentType: a.contentType, size: a.size, url: a.url, publicId: a.publicId, contentId: null }))
    )
  }

  try {
    await resend.emails.send({
      from: `${senderName} <${fromEmail}>`,
      replyTo: replyToAddr,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: isForward && !/^fwd:/i.test(subject || '') ? `Fwd: ${subject}` : subject,
      html,
      attachments: forwardAttachments ?? (files.length ? files.map(f => ({ content: f.buffer, filename: f.originalname })) : undefined),
    })

    if (effectiveThreadId) {
      try {
        const msg = await db.threadMessage.create({
          data: {
            organizationId: org.id,
            threadId: effectiveThreadId,
            direction: 'outbound',
            fromName: req.user!.username,
            fromEmail,
            toEmails: to,
            ccEmails: cc.length ? cc.join(',') : null,
            bccEmails: bcc.length ? bcc.join(',') : null,
            body: html,
            sentById: req.user!.id,
          },
        })

        // Pièces jointes ajoutées manuellement à cette réponse (pas celles reprises d'un transfert)
        if (!isForward) {
          const stored: StoredAttachment[] = []
          for (const f of files) {
            const base: StoredAttachment = { filename: f.originalname, contentType: f.mimetype || null, size: f.size, url: '', publicId: null, contentId: null }
            if (org && f.size <= MAX_ATTACHMENT_BYTES) {
              try {
                const up = await uploadBufferToCloudinary(f.buffer, f.originalname, f.mimetype || null, buildOrgFolder(org.id))
                base.url = up.url
                base.publicId = up.publicId
              } catch (e) {
                console.error(`[REPLY] Stockage pièce jointe ${f.originalname}:`, (e as Error).message)
              }
            }
            stored.push(base)
          }
          await saveAttachmentRecords(db, msg.id, stored)
        }
      } catch (e) {
        console.error('[THREAD-MSG-OUT]', (e as Error).message)
      }

      await db.thread.updateMany({ where: { id: effectiveThreadId, status: 'nouveau' }, data: { status: 'en_cours' } }).catch(() => {})
      await createActivity(db, org.id, effectiveThreadId, req.user!.id, isForward ? 'forwarded' : createdThreadId ? 'sent' : 'replied', { by: req.user!.nom })
    }

    if (typeof draftId === 'string' && draftId) {
      await db.mailDraft.deleteMany({ where: { id: draftId, userId: req.user!.id } }).catch(() => {})
    }

    res.json({ success: true, message: 'E-mail envoyé avec succès', threadId: effectiveThreadId })
  } catch (error) {
    console.error("Erreur d'envoi:", error)
    if (createdThreadId) {
      await db.thread.delete({ where: { id: createdThreadId } }).catch(() => {})
    }
    res.status(500).json({ error: "Erreur lors de l'envoi de l'e-mail." })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// POST /api/inbound-mail/:webhookToken — webhook Resend, un par organisation.
// Pas de JWT : authentifié par (a) le token imprévisible dans l'URL, qui
// identifie l'org, et (b) la signature Svix vérifiée avec LE secret de CETTE org.
// ─────────────────────────────────────────────────────────────────────────
router.post('/inbound-mail/:webhookToken', async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { webhookToken: req.params.webhookToken } })
  if (!org) {
    // 404 générique — ne révèle pas si le token existe sous une autre forme
    return res.status(404).json({ error: 'Introuvable' })
  }
  if (!org.webhookSecretEnc) {
    console.warn(`[INBOUND] Org ${org.id} : webhook appelé mais aucun secret configuré`)
    return res.status(401).json({ error: 'Webhook non configuré' })
  }

  const secret = getDecryptedWebhookSecret(org)
  if (!verifyResendWebhook(req, secret)) {
    console.warn(`[INBOUND] Org ${org.id} : signature webhook invalide`)
    return res.status(401).json({ error: 'Signature invalide' })
  }

  // Répondre immédiatement pour ne pas bloquer Resend (timeout 10s)
  res.status(200).json({ ok: true })

  try {
    await processInboundEmail(org, req.body)
  } catch (err) {
    console.error(`[INBOUND] Org ${org.id} : erreur de traitement`, err)
  }
})

async function processInboundEmail(org: Organization, payload: unknown): Promise<void> {
  const db = forOrg(org.id)
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

  console.log(`[INBOUND] Org ${org.id} : de=${fromRaw} -> à=${toAddr} (id=${emailId})`)

  let htmlBody = ''
  let textBody = ''
  if (emailId) {
    try {
      const emailRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      })
      if (emailRes.ok) {
        const emailData = (await emailRes.json()) as { html?: string; text?: string }
        htmlBody = emailData.html || ''
        textBody = emailData.text || ''
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

  // ── Réponse externe via token (reply+TOKEN@domaine) ──────────────────────
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

    // Nouveau token pour la prochaine réponse (chaîne bidirectionnelle)
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
          threadId: replyToken.threadId,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })
      const domain = replyToken.aliasFrom.split('@')[1]
      clientReplyTo = `reply+${nextToken.token}@${domain}`
    } catch (e) {
      console.error('[INBOUND-REPLY] next token:', (e as Error).message)
    }

    await resend.emails.send({
      from: `${org.companyName || org.name} <${replyToken.aliasFrom}>`,
      replyTo: clientReplyTo,
      to: replyToken.externalTo,
      cc: replyToken.externalCc ? replyToken.externalCc.split(',') : undefined,
      bcc: replyToken.externalBcc ? replyToken.externalBcc.split(',') : undefined,
      subject: /^re:/i.test(subject) ? subject : `Re: ${replyToken.subject || subject}`,
      html: cleanHtml,
      attachments: toResendAttachments(inboundAttachments),
    })
    console.log(`[INBOUND-REPLY] Org ${org.id} : ${replyToken.aliasFrom} -> ${replyToken.externalTo}`)

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

  // ── Email entrant normal ────────────────────────────────────────────────
  const canal = toAddr.split('@')[0].toLowerCase()
  const inboundHtml = replaceCidReferences(
    htmlBody || `<p>${textBody.replace(/\n/g, '<br>')}</p>`,
    storedAttachments
  )

  const activeThread = await db.thread.findFirst({
    where: { externalEmail: fromAddr, canal, status: { not: 'resolu' } },
    orderBy: { createdAt: 'desc' },
    include: { assignedTo: { select: { id: true, email: true, nom: true } } },
  })

  let threadId: string
  if (activeThread) {
    const msg = await db.threadMessage.create({
      data: { organizationId: org.id, threadId: activeThread.id, direction: 'inbound', fromName: senderName, fromEmail: fromAddr, body: inboundHtml },
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
    })
    const firstMessageId = newThread.messages?.[0]?.id
    if (firstMessageId) await saveAttachmentRecords(db, firstMessageId, storedAttachments)
    threadId = newThread.id
    console.log(`[INBOUND] Org ${org.id} : nouveau thread créé ${threadId}`)
  }

  // Forwarding via MailRoute (optionnel, en parallèle du thread dans le dashboard)
  const route = await db.mailRoute.findFirst({ where: { alias: toAddr, active: true } })
  if (!route) {
    console.log(`[INBOUND] Org ${org.id} : pas de MailRoute pour ${toAddr} — thread créé, pas de transfert`)
    return
  }

  const thread = await db.thread.findUnique({ where: { id: threadId }, select: { assignedToId: true } })
  if (!thread?.assignedToId) {
    const owner = await db.user.findFirst({ where: { email: route.personalEmail } })
    if (owner) {
      await db.thread.update({ where: { id: threadId }, data: { assignedToId: owner.id } })
      await createActivity(db, org.id, threadId, null, 'assigned', { to: owner.nom })
    }
  }

  const inboundToken = await db.mailReplyToken.create({
    data: { organizationId: org.id, aliasFrom: route.alias, externalTo: fromAddr, subject, threadId, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
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

export default router
