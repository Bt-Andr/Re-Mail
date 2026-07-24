# Resend Mail Module

Backend multi-tenant : chaque organisation connecte son propre compte Resend
(sa clé API, son domaine déjà vérifié) pour transformer les emails entrants en
conversations (threads) consultables via API — destiné à un dashboard web puis,
en phase 2, une app mobile React Native/Expo.

Ce projet est une évolution multi-tenant du système de messagerie mono-tenant
de `jeprogroup-website` (relais Resend → threads → dashboard).

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL, JWT_SECRET, MASTER_ENCRYPTION_KEY
npm run prisma:migrate
npm run dev
```

`MASTER_ENCRYPTION_KEY` : `openssl rand -base64 32` — chiffre les clés API Resend
et secrets de webhook de chaque organisation au repos (voir `src/lib/crypto.ts`).

## Onboarding d'une organisation

1. `POST /api/auth/signup` — crée l'organisation + le premier utilisateur (OWNER)
2. `POST /api/organizations/me/resend/connect` avec `{ apiKey }` — valide la clé
   Resend, la stocke chiffrée, renvoie `webhookUrl` (unique à cette org)
3. Dans le dashboard Resend de l'org : Domaines → Inbound → coller `webhookUrl`,
   copier le secret de signature affiché
4. `POST /api/organizations/me/resend/webhook-secret` avec `{ webhookSecret }`
5. `POST /api/mail-routes` pour créer un ou plusieurs alias (`contact@domaine.com` → boîte perso, etc.)

## Isolation multi-tenant

Toute donnée par organisation passe par `forOrg(organizationId)`
(`src/middleware/scopedPrisma.ts`) — une extension Prisma qui injecte
automatiquement `organizationId` dans chaque requête sur les modèles
multi-tenant. Les routes ne doivent jamais importer `prisma` directement pour
lire/écrire des données de tenant — exceptions volontaires et vérifiées :
`routes/auth.ts` (signup crée le premier org+user, login résout l'org depuis le
username global) et `routes/organizations.ts` (opère toujours sur
`req.user.organizationId`, jamais sur un id fourni par le client).

## Tests

```bash
npm test
```

Couvre : signature Svix du webhook (sans compte Resend réel), isolation entre
deux organisations, chiffrement/déchiffrement, notifications push, CC/BCC/transfert.

## Hors périmètre (v1)

App mobile (écrans), billing, infra multi-instance, autres fournisseurs mail
que Resend, 2FA.
