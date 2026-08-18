import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { Organization, User } from '@prisma/client'
import prisma from './prisma'

// Supprime les diacritiques (accents) après normalisation NFD, ex. "é" -> "e"
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", 'g')

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_DIACRITICS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org'
  )
}

export async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt += 1
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    if (attempt > 10) throw new Error('Impossible de générer un identifiant unique.')
  }
  return slug
}

// Même désambiguïsation que uniqueSlug, mais pour username (charset plus permissif que
// slug — pas de limite de longueur imposée par un usage dans une URL).
export async function uniqueUsername(base: string): Promise<string> {
  const sanitizedBase = base.toLowerCase().replace(/[^a-z0-9._-]+/g, '') || 'user'
  let username = sanitizedBase
  let attempt = 0
  while (await prisma.user.findUnique({ where: { username } })) {
    attempt += 1
    username = `${sanitizedBase}-${Math.random().toString(36).slice(2, 6)}`
    if (attempt > 10) throw new Error("Impossible de générer un nom d'utilisateur unique.")
  }
  return username
}

export interface CreateOrgAndOwnerInput {
  orgName: string
  isPersonal: boolean
  username: string
  email: string
  passwordHash: string
  nom: string
}

// Crée une organisation + son premier utilisateur (OWNER) en une seule transaction —
// utilisé par POST /auth/signup ET par le flux de connexion Google (routes/gmailOAuth.ts,
// intent 'signin', voir createPersonalAccountFromGoogle) pour ne jamais dupliquer cette
// logique entre les deux chemins de création de compte perso.
export async function createOrgAndOwner(input: CreateOrgAndOwnerInput): Promise<{ organization: Organization; user: User }> {
  const slug = await uniqueSlug(slugify(input.orgName))
  return prisma.$transaction(async tx => {
    const organization = await tx.organization.create({
      data: { name: input.orgName.trim(), slug, isPersonal: input.isPersonal },
    })
    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        username: input.username,
        email: input.email,
        password: input.passwordHash,
        nom: input.nom,
        orgRole: 'OWNER',
      },
    })
    return { organization, user }
  })
}

// Utilisé uniquement par le flux "se connecter avec Google" (compte perso créé à la
// volée, aucune saisie utilisateur disponible à ce stade) : nom d'org/username
// auto-dérivés de la partie locale de l'email, mot de passe = hash aléatoire
// inutilisable (ce compte ne s'authentifie que via Google, jamais par mot de passe).
export async function createPersonalAccountFromGoogle(email: string): Promise<{ organization: Organization; user: User }> {
  const nom = email.split('@')[0]
  const username = await uniqueUsername(nom)
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
  return createOrgAndOwner({ orgName: nom, isPersonal: true, username, email, passwordHash, nom })
}

// Même principe que createPersonalAccountFromGoogle, pour le flux "se connecter via
// IMAP" (routes/mailboxConnections.ts, POST /imap/signin) : la preuve de possession de
// l'adresse est la connexion IMAP réussie elle-même, pas un flux OAuth, mais le niveau
// de confiance est le même (il faut connaître le mot de passe réel de cette boîte) — même
// hash de mot de passe aléatoire inutilisable, ce compte s'authentifie via cette boîte
// mail, jamais par mot de passe classique.
export async function createPersonalAccountFromMailbox(email: string): Promise<{ organization: Organization; user: User }> {
  const nom = email.split('@')[0]
  const username = await uniqueUsername(nom)
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
  return createOrgAndOwner({ orgName: nom, isPersonal: true, username, email, passwordHash, nom })
}
