# Resend Mail Module — contexte projet

## Quoi

SaaS multi-tenant : chaque organisation connecte son propre compte Resend (sa clé API, son domaine déjà vérifié) pour transformer ses emails entrants en conversations (threads) consultables via API/dashboard/app mobile. Backend + dashboard web complets et testés. Projet indépendant de `jeprogroup-website` (référence mono-tenant dont l'architecture a été portée ici, adaptée au multi-tenant).

## Feuille de route (phases)

1. **Backend "module Resend" multi-tenant** — ✅ fait, testé (40 tests)
2. **Activation par fichier + code** (onboarding utilisateur non-technique) — ✅ fait, testé
3. **Dashboard web minimal** (`web/`) — ✅ fait, vérifié manuellement de bout en bout
4. **App mobile React Native/Expo** — ❌ pas commencée. C'est la prochaine étape naturelle.

## Ce qu'il faut savoir avant de toucher au code

- **Isolation tenant** : toute donnée par organisation passe par `forOrg(organizationId)` (`src/middleware/scopedPrisma.ts`), une extension Prisma qui injecte automatiquement `organizationId`. Les routes ne doivent **jamais** importer `prisma` brut pour lire/écrire des données de tenant. Exceptions volontaires : `routes/auth.ts` (signup crée le premier org+user, login résout l'org depuis le username global), `routes/organizations.ts` et `routes/publicUserInvites.ts` (lookups globaux avant que l'org soit connue — token de webhook, token d'invitation).
- **Gotcha Prisma** : `organizationId` doit être écrit explicitement dans `data` de chaque `.create()` (le typage généré l'exige même si l'extension l'injecte aussi au runtime). Pour tout modèle où l'unicité est composite avec `organizationId` (ex. `canal` sur `ThreadRoutingRule`), utiliser `findFirst` + create/update manuel plutôt que `findUnique`/`upsert` (voir `src/routes/routingRules.ts`).
- **Deux clés de chiffrement séparées**, jamais interchangées : `MASTER_ENCRYPTION_KEY` (clés API Resend/secrets webhook par org) et `INVITE_FILE_ENCRYPTION_KEY` (fichiers d'invitation). Les deux dans `.env`, générées via `openssl rand -base64 32`.
- **Activation par fichier + code** (`UserInvite`) : le fichier téléchargeable et le code d'activation sont volontairement découplés (deux secrets, deux canaux). Le `User` réel n'est créé qu'à l'activation finale (`POST /api/public/user-invites/activate`), jamais avant.
- **Sender emails** : `GET /api/emails/senders` détermine qui peut envoyer depuis quelle adresse (`src/helpers/senders.ts`). Si vide, le composeur du dashboard doit se désactiver proprement (`ComposerPanel` → `NoSendersNotice`).

## Lancer le projet en local

Deux processus séparés, deux terminaux :

```bash
# Backend (port 3001)
cd resend-mail-module
npm run dev

# Frontend (port 5173)
cd resend-mail-module/web
npm run dev
```

Base de données de test/dev : conteneur Postgres jetable Docker.
```bash
docker start resend-mail-test-db   # ou le recréer si besoin, voir DATABASE_URL dans .env
```
`.env` (backend) et `web/.env` doivent exister — voir `.env.example` / `web/.env.example`.

## Tests

```bash
cd resend-mail-module && npm test   # 40 tests, nécessite le conteneur Postgres démarré
```
Le frontend n'a pas de suite automatisée (UI greenfield, validation manuelle privilégiée — voir `npm run typecheck` / `npm run build` dans `web/`).

## État du dépôt

Rien n'est encore commité (fichiers `git add`-stagés au fil du build, jamais de commit créé). À faire dès que l'utilisateur le demande explicitement.