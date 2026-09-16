import { Router } from 'express'
import nodemailer from 'nodemailer'
import type { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { forOrg } from '../middleware/scopedPrisma'
import { authenticateToken } from '../middleware/auth'
import { attachmentUpload } from '../lib/upload'
import { parseRequest } from '../validation/request'
import { emailReplySchema } from '../validation/schemas'
import { buildResendClient } from '../lib/resendClient'
import { getDecryptedResendKey, getDecryptedWebhookSecret } from '../helpers/resendAccount'
import { getMailboxAuth } from '../lib/mailboxAuth'
import { verifyResendWebhook } from '../helpers/webhookSignature'
import { getAllowedSenders } from '../helpers/senders'
import { createActivity } from '../helpers/thread'
import { normalizeMessageId, parseMessageIdList } from '../helpers/threadCorrelation'
import { enqueueResendInboundEvent, processInboundEvent } from '../jobs/inboundEventProcessor'
import { processInboundEmail } from '../services/inboundEmail'
import {
  saveAttachmentRecords,
  storedToResendAttachments,
  uploadBufferToCloudinary,
  buildOrgFolder,
  MAX_ATTACHMENT_BYTES,
  StoredAttachment,
} from '../helpers/attachments'

const router = Router()

type ForwardSourceMessage = Prisma.ThreadMessageGetPayload<{ include: { attachments: true } }>

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
  const input = parseRequest(emailReplySchema, req.body, res)
  if (!input) return
  const { to, subject, message, threadId, draftId, mode, sourceMessageId, cc, bcc, fromEmail: requestedFromEmail } = input
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const isForward = mode === 'forward'
  let forwardSource: ForwardSourceMessage | null = null

  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org) return res.status(404).json({ error: 'Organisation introuvable.' })

  const db = forOrg(req.user!.organizationId)
  const allowed = await getAllowedSenders(db, req.user!.id)
  let fromEmail = ''
  let senderName = org.companyName || org.name

  if (threadId) {
    // Une réponse (ou un transfert) part obligatoirement de l'adresse qui a reçu le mail
    let receivedOn: string | null = null
    try {
      const thread = await db.thread.findUnique({
        where: { id: threadId },
        select: { toEmail: true, assignedToId: true, sourceId: true },
      })
      if (!thread) return res.status(404).json({ error: 'Thread introuvable.' })
      if (thread.sourceId) {
        const ownedMailbox = await db.externalMailboxConnection.findFirst({
          where: { id: thread.sourceId, userId: req.user!.id },
          select: { id: true },
        })
        if (!ownedMailbox) return res.status(403).json({ error: 'Accès non autorisé.' })
      }
      const isManager = req.user!.orgRole === 'OWNER' || req.user!.orgRole === 'ADMIN'
      if (!isManager && thread.assignedToId !== req.user!.id) {
        return res.status(403).json({ error: 'Accès non autorisé.' })
      }
      receivedOn = thread.toEmail ?? null
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

    if (isForward) {
      forwardSource = await db.threadMessage.findFirst({
        where: { id: sourceMessageId, threadId },
        include: { attachments: true },
      })
      if (!forwardSource) {
        return res.status(404).json({ error: 'Message à transférer introuvable.' })
      }
    }
  }

  if (!fromEmail) {
    const requestedFrom = requestedFromEmail?.toLowerCase() ?? ''
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

  // Un expéditeur peut être soit une adresse du domaine Resend de l'org, soit une boîte
  // externe connectée par CET utilisateur (voir ExternalMailboxConnection) — deux
  // mécanismes d'envoi différents, déterminés une fois fromEmail résolu ci-dessus. Un
  // compte perso qui n'a connecté qu'une boîte externe (pas de clé Resend) doit pouvoir
  // envoyer : la vérification resendApiKeyEnc ne s'applique donc qu'à la branche Resend.
  const mailbox = await db.externalMailboxConnection.findFirst({
    where: { email: fromEmail, userId: req.user!.id, status: 'connected' },
  })
  if (!mailbox && !org.resendApiKeyEnc) {
    return res.status(400).json({ error: 'Aucun compte Resend connecté pour cette organisation.' })
  }

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
          sourceId: mailbox?.id ?? null,
          sourceType: mailbox?.provider ?? null,
        },
      })
      effectiveThreadId = newThread.id
      createdThreadId = newThread.id
    } catch (e) {
      console.error('[SEND] Création thread sortant:', (e as Error).message)
    }
  }

  // reply+{token}@{domaine} ne fonctionne que parce que Resend route le courrier entrant
  // vers le domaine vérifié de l'org — sans objet pour un envoi SMTP : les réponses
  // arrivent directement dans la boîte externe de l'utilisateur, rattachées au fil par le
  // poller via externalEmail/canal, le même chemin que le courrier entrant non tokenisé.
  let replyToAddr = fromEmail
  if (effectiveThreadId && !mailbox) {
    try {
      const replyToken = await db.mailReplyToken.create({
        data: {
          organizationId: org.id,
          aliasFrom: fromEmail,
          externalTo: to,
          externalCc: cc.length ? cc.join(',') : null,
          externalBcc: bcc.length ? bcc.join(',') : null,
          subject,
          purpose: 'conversation',
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
  if (forwardSource) {
    const source = forwardSource
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

  let outboundInReplyTo: string | null = null
  let outboundReferences: string[] = []
  if (effectiveThreadId && !isForward) {
    const latestIdentifiedMessage = await db.threadMessage.findFirst({
      where: { threadId: effectiveThreadId, internetMessageId: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { internetMessageId: true, references: true },
    })
    outboundInReplyTo = normalizeMessageId(latestIdentifiedMessage?.internetMessageId)
    outboundReferences = parseMessageIdList([
      ...(latestIdentifiedMessage?.references ?? []),
      latestIdentifiedMessage?.internetMessageId,
    ])
  }
  const threadingHeaders = outboundInReplyTo
    ? { 'In-Reply-To': outboundInReplyTo, References: outboundReferences.join(' ') }
    : undefined

  try {
    const emailSubject = isForward && !/^fwd:/i.test(subject || '') ? `Fwd: ${subject}` : subject
    const emailAttachments = forwardAttachments ?? (files.length ? files.map(f => ({ content: f.buffer, filename: f.originalname })) : undefined)
    let sentInternetMessageId: string | null = null

    if (mailbox) {
      // storedToResendAttachments()/pièces jointes manuelles produisent déjà {path|content, filename},
      // un format que nodemailer consomme tel quel (pas de conversion nécessaire).
      const mailboxAuth = await getMailboxAuth(mailbox)
      const transporter = nodemailer.createTransport({
        host: mailbox.smtpHost,
        port: mailbox.smtpPort,
        secure: mailbox.smtpSecure,
        // nodemailer exige le discriminant explicite type:'OAuth2' pour activer XOAUTH2 —
        // sans ça, un accessToken serait traité comme un mot de passe LOGIN/PLAIN classique
        // et l'envoi échouerait silencieusement contre les serveurs Google.
        auth: 'accessToken' in mailboxAuth ? { type: 'OAuth2', ...mailboxAuth } : mailboxAuth,
      })
      const sent = await transporter.sendMail({
        from: `${senderName} <${fromEmail}>`,
        replyTo: replyToAddr,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject: emailSubject,
        html,
        attachments: emailAttachments,
        headers: threadingHeaders,
      })
      sentInternetMessageId = normalizeMessageId(sent?.messageId)
    } else {
      const resend = buildResendClient(getDecryptedResendKey(org))
      const sent = await resend.emails.send({
        from: `${senderName} <${fromEmail}>`,
        replyTo: replyToAddr,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject: emailSubject,
        html,
        attachments: emailAttachments,
        headers: threadingHeaders,
      })
      if (sent.error) throw new Error(sent.error.message)
    }

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
            internetMessageId: sentInternetMessageId,
            inReplyTo: outboundInReplyTo,
            references: outboundReferences,
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

  try {
    // La réponse 200 signifie désormais « événement durablement accepté », et non
    // « traitement lancé en mémoire ». Le svix-id est la clé idempotente fournie par
    // Resend ; une répétition du webhook retrouve la même ligne.
    const externalId = req.header('svix-id')!
    const event = await enqueueResendInboundEvent(org.id, externalId, req.body)
    res.status(200).json({ ok: true })
    void processInboundEvent(event.id, processInboundEmail).catch(err => {
      console.error(`[INBOUND] Org ${org.id} : lancement du traitement`, err)
    })
  } catch (err) {
    // Sans persistance, aucun ACK : Resend pourra retenter l'événement.
    console.error(`[INBOUND] Org ${org.id} : persistance impossible`, err)
    if (!res.headersSent) res.status(500).json({ error: 'Réception temporairement indisponible' })
  }
})

export default router
