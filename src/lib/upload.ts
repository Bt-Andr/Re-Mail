import multer from 'multer'
import { MAX_ATTACHMENT_BYTES } from '../helpers/attachments'

// Stockage en mémoire (pas sur disque) : les fichiers sont directement relayés
// vers Resend et/ou Cloudinary depuis le buffer, jamais écrits localement.
export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 5 },
})

// Fichiers d'invitation d'activation (voir routes/publicUserInvites.ts) : le
// payload chiffré est minuscule (un token), donc une limite de taille bien plus
// stricte suffit et réduit la surface d'abus de cet endpoint public non authentifié.
export const inviteFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024, files: 1 },
})
