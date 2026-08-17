# Resend Mail Module — contexte projet

## Quoi

SaaS multi-tenant : chaque organisation connecte son propre compte Resend (sa clé API, son domaine déjà vérifié) pour transformer ses emails entrants en conversations (threads) consultables via API/dashboard/app mobile. Backend + dashboard web complets et testés. Projet indépendant de `jeprogroup-website` (référence mono-tenant dont l'architecture a été portée ici, adaptée au multi-tenant).

## Feuille de route (phases)

1. **Backend "module Resend" multi-tenant** — ✅ fait, testé (40 tests)
2. **Activation par fichier + code** (onboarding utilisateur non-technique) — ✅ fait, testé
3. **Frontends web séparés** — ✅ `web/` pour l'administration d'une organisation (OWNER/ADMIN), `webmail/` pour la messagerie et les comptes personnels
4. **App mobile React Native/Expo** (`mobile/`) — 🚧 en cours.
5. **Dashboard admin plateforme** (`Dashboard/`) — 🚧 scaffold (TanStack Start + shadcn/ui) nettoyé de ses dépendances Lovable, pas encore branché aux vraies données. Contenu actuel = placeholder de démo bancaire (voir `Dashboard/README.md`) à remplacer par de la gestion cross-tenant (organisations, utilisateurs, mail routes...) — aucun outil de ce type n'existait avant.

## Ce qu'il faut savoir avant de toucher au code

- **Isolation tenant** : toute donnée par organisation passe par `forOrg(organizationId)` (`src/middleware/scopedPrisma.ts`), une extension Prisma qui injecte automatiquement `organizationId`. Les routes ne doivent **jamais** importer `prisma` brut pour lire/écrire des données de tenant. Exceptions volontaires : `routes/auth.ts` (signup crée le premier org+user, login résout l'org depuis le username global), `routes/organizations.ts` et `routes/publicUserInvites.ts` (lookups globaux avant que l'org soit connue — token de webhook, token d'invitation). Trois autres fichiers importent aussi `prisma` brut mais restent dans le même cas (lookup global scopé par un id issu du JWT ou d'un token, jamais un modèle tenant renvoyé tel quel au client) : `routes/threads.ts` et `routes/mail.ts` (`prisma.organization.findUnique` par id JWT ou `webhookToken`), `routes/userInvites.ts` (`prisma.user`/`userInvite.findFirst` en `OR` global, utilisé uniquement comme contrôle d'unicité booléen, jamais retourné). `routes/gmailOAuth.ts` fait de même pour le flux "se connecter avec Google" (`prisma.user.findUnique` par email, avant qu'une session/org existe — résout ou crée le compte perso qui devient ensuite le contexte `forOrg()` pour tout le reste du callback). Toute nouvelle route qui a besoin d'un lookup global doit suivre exactement ce même pattern — jamais réutiliser `prisma` brut pour lire/écrire un modèle scopé par tenant (`SCOPED_MODELS` dans `scopedPrisma.ts`).
- **Gotcha Prisma** : `organizationId` doit être écrit explicitement dans `data` de chaque `.create()` (le typage généré l'exige même si l'extension l'injecte aussi au runtime). Pour tout modèle où l'unicité est composite avec `organizationId` (ex. `canal` sur `ThreadRoutingRule`), utiliser `findFirst` + create/update manuel plutôt que `findUnique`/`upsert` (voir `src/routes/routingRules.ts`).
- **Deux clés de chiffrement séparées**, jamais interchangées : `MASTER_ENCRYPTION_KEY` (clés API Resend/secrets webhook par org) et `INVITE_FILE_ENCRYPTION_KEY` (fichiers d'invitation). Les deux dans `.env`, générées via `openssl rand -base64 32`.
- **Activation par fichier + code** (`UserInvite`) : le fichier téléchargeable et le code d'activation sont volontairement découplés (deux secrets, deux canaux). Le `User` réel n'est créé qu'à l'activation finale (`POST /api/public/user-invites/activate`), jamais avant.
- **Sender emails** : `GET /api/emails/senders` détermine qui peut envoyer depuis quelle adresse (`src/helpers/senders.ts`). Si vide, le composeur du dashboard doit se désactiver proprement (`ComposerPanel` → `NoSendersNotice`).

## Lancer le projet en local

Processus séparés, un terminal chacun :

```bash
# Backend (port 3001)
cd resend-mail-module
npm run dev

# Administration d'une organisation (port 5173)
cd resend-mail-module/web
npm run dev

# Messagerie utilisateur (port 5174)
cd resend-mail-module/webmail
npm run dev

# Dashboard admin plateforme (port 8080) — scaffold, pas encore branché
cd resend-mail-module/Dashboard
npm run dev
```

Base de données de test/dev : conteneur Postgres jetable Docker.
```bash
docker start resend-mail-test-db   # ou le recréer si besoin, voir DATABASE_URL dans .env
```
`.env` (backend), `web/.env` et `webmail/.env` doivent exister — voir les fichiers
`.env.example` correspondants. Le backend doit définir `FRONTEND_URL` pour `web/`,
`WEBMAIL_URL` pour `webmail/`, et autoriser les deux dans `ALLOWED_ORIGINS`.

## Tests

```bash
cd resend-mail-module && npm test   # 135 tests, nécessite le conteneur Postgres démarré
```
Le frontend n'a pas de suite automatisée (UI greenfield, validation manuelle privilégiée — voir `npm run typecheck` / `npm run build` dans `web/` et `webmail/`).

## État du dépôt

Historique git actif sur `main` depuis la refonte multi-frontends (monorepo npm workspaces, scission `web/`+`webmail/`, `packages/design-tokens`). Commits créés au fil de l'eau par Claude/Codex ; à ne créer que sur demande explicite de l'utilisateur, comme pour tout le reste du dépôt.
