import type { PrismaClient } from '@prisma/client'
import { cloudinary } from '../lib/cloudinary'
import config from '../config'

// Au-delà, le fichier n'est pas stocké sur Cloudinary (limite des comptes gratuits)
// mais reste référencé dans le thread et transféré par email.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export interface ResendAttachment {
  id: string
  filename: string
  content_type?: string
  size?: number
  content_id?: string
  content_disposition?: string
  download_url: string
}

export interface StoredAttachment {
  filename: string
  contentType: string | null
  size: number | null
  url: string // '' si le fichier n'a pas pu être stocké (trop volumineux ou échec d'upload)
  publicId: string | null
  contentId: string | null
}

// Liste les pièces jointes d'un email entrant via l'API Resend DE L'ORGANISATION
// concernée (le webhook ne contient que les métadonnées, jamais le contenu).
export async function fetchInboundAttachments(emailId: string, resendApiKey: string): Promise<ResendAttachment[]> {
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    })
    if (!res.ok) {
      console.warn(`[ATTACHMENTS] Liste impossible (${res.status}) pour email ${emailId}`)
      return []
    }
    const json = (await res.json()) as { data?: ResendAttachment[] }
    return json.data ?? []
  } catch (e) {
    console.error('[ATTACHMENTS] fetch liste:', (e as Error).message)
    return []
  }
}

// Uploade un buffer sur Cloudinary (compte partagé pour tout le SaaS) et renvoie
// les infos de stockage. `folder` doit toujours inclure l'organizationId de l'appelant
// (voir buildOrgFolder ci-dessous) pour garder les fichiers de chaque org séparés.
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  filename: string,
  contentType: string | null,
  folder: string
): Promise<{ url: string; publicId: string }> {
  const isImage = (contentType || '').startsWith('image/')
  // Suffixe unique pour éviter les collisions entre fichiers homonymes (ex. deux "CV.pdf")
  const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const publicId = isImage ? safeName.replace(/\.[^.]+$/, '') : safeName

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: isImage ? 'image' : 'raw', public_id: publicId, overwrite: false },
      (error, result) =>
        error || !result ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id })
    )
    stream.end(buffer)
  })
}

export function buildOrgFolder(organizationId: string): string {
  return `orgs/${organizationId}/mail`
}

// Télécharge chaque pièce jointe (download_url Resend, valide 1h, déjà pré-autorisée
// donc pas besoin de clé API ici) et la stocke sur Cloudinary de façon permanente,
// dans le dossier de l'organisation. Les fichiers trop volumineux ou en échec sont
// renvoyés avec url '' pour rester visibles dans le thread.
export async function uploadInboundAttachments(
  attachments: ResendAttachment[],
  organizationId: string
): Promise<StoredAttachment[]> {
  if (!attachments.length) return []

  const stored: StoredAttachment[] = []
  for (const att of attachments) {
    const base: StoredAttachment = {
      filename: att.filename,
      contentType: att.content_type || null,
      size: att.size ?? null,
      url: '',
      publicId: null,
      contentId: att.content_id?.replace(/[<>]/g, '') || null,
    }

    if (!config.cloudinaryCloudName) {
      console.warn('[ATTACHMENTS] Cloudinary non configuré — pièce jointe non stockée')
      stored.push(base)
      continue
    }
    if (att.size && att.size > MAX_ATTACHMENT_BYTES) {
      console.warn(`[ATTACHMENTS] ${att.filename} trop volumineux (${att.size} o) — non stocké`)
      stored.push(base)
      continue
    }

    try {
      const fileRes = await fetch(att.download_url)
      if (!fileRes.ok) {
        console.warn(`[ATTACHMENTS] Téléchargement impossible (${fileRes.status}) : ${att.filename}`)
        stored.push(base)
        continue
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer())
      if (buffer.length > MAX_ATTACHMENT_BYTES) {
        console.warn(`[ATTACHMENTS] ${att.filename} trop volumineux (${buffer.length} o) — non stocké`)
        stored.push({ ...base, size: buffer.length })
        continue
      }

      const uploaded = await uploadBufferToCloudinary(buffer, att.filename, base.contentType, buildOrgFolder(organizationId))
      stored.push({ ...base, size: att.size ?? buffer.length, url: uploaded.url, publicId: uploaded.publicId })
      console.log(`[ATTACHMENTS] Stockée : ${att.filename}`)
    } catch (e) {
      console.error(`[ATTACHMENTS] Échec stockage ${att.filename}:`, (e as Error)?.message ?? e)
      stored.push(base)
    }
  }
  return stored
}

// Crée les enregistrements ThreadAttachment pour un message donné.
// ThreadAttachment n'a pas de organizationId propre (il dépend de messageId, déjà
// scopé) — `db` peut donc être un client scopé ou non, ça n'a pas d'effet ici.
export async function saveAttachmentRecords(db: PrismaClient, messageId: string, stored: StoredAttachment[]): Promise<void> {
  if (!stored.length) return
  try {
    await db.threadAttachment.createMany({
      data: stored.map(s => ({
        messageId,
        filename: s.filename,
        contentType: s.contentType,
        size: s.size,
        url: s.url,
        publicId: s.publicId,
      })),
    })
  } catch (e) {
    console.error('[ATTACHMENTS] saveAttachmentRecords:', (e as Error).message)
  }
}

// Remplace les références cid: (images intégrées au corps du mail) par les URLs
// Cloudinary pour qu'elles s'affichent dans le dashboard et les mails transférés.
export function replaceCidReferences(html: string, stored: StoredAttachment[]): string {
  let out = html
  for (const s of stored) {
    if (!s.contentId || !s.url) continue
    out = out.split(`cid:${s.contentId}`).join(s.url)
  }
  return out
}

// Format attendu par resend.emails.send pour re-transférer les pièces jointes
// d'un email entrant (URLs temporaires Resend, valides ~1h).
export function toResendAttachments(attachments: ResendAttachment[]) {
  return attachments.length
    ? attachments.map(a => ({ path: a.download_url, filename: a.filename }))
    : undefined
}

// Pour un transfert (forward) : les pièces jointes sont déjà stockées de façon
// permanente sur Cloudinary, pas besoin de les re-télécharger depuis Resend.
export function storedToResendAttachments(stored: StoredAttachment[]) {
  const withUrl = stored.filter(s => s.url)
  return withUrl.length ? withUrl.map(s => ({ path: s.url, filename: s.filename })) : undefined
}
