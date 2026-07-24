import { v2 as cloudinary } from 'cloudinary'
import config from '../config'

// Compte Cloudinary partagé pour l'ensemble du SaaS (ce n'est pas un secret par
// organisation) — les pièces jointes de chaque org sont rangées dans un dossier
// dédié (voir helpers/attachments.ts : folder = `orgs/${organizationId}/mail`).
cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
})

export { cloudinary }
