# Exporter / importer une configuration mail (migration d'organisation)

Ce document explique le format CSV produit par **Réglages → Export de la configuration mail** (`GET /api/organizations/me/export`, OWNER/ADMIN) et comment le réimporter — soit via **Réglages → Importer un CSV** (`POST /api/organizations/me/import`, OWNER/ADMIN) si la cible est une organisation de ce même produit (§3, Cas A), soit manuellement si la cible a une architecture différente (§3, Cas B, ex. `jeprogroup-website`).

Cas d'usage typique du Cas A : migrer un environnement mail existant (dashboard propriétaire externe, ou une autre organisation de ce produit) vers une organisation Re-Mail, y compris ses utilisateurs, sans que chacun ait à être recréé à la main.

## 1. Prérequis côté organisation cible

Avant d'importer quoi que ce soit, l'organisation cible doit déjà avoir, avec **son propre** compte Resend (jamais celui de l'organisation source) :

1. Une clé API Resend connectée.
2. Un domaine vérifié chez Resend (peut être différent du domaine source).
3. Un webhook `email.received` créé dans le dashboard Resend cible, avec son propre secret de signature.

L'export ne contient volontairement aucun secret (clé API, secret de webhook, mot de passe) — voir §4. Sans ces trois prérequis en place, les alias importés ne recevront jamais rien.

## 2. Contenu et format du CSV

Le fichier est découpé en 5 sections, séparées par une ligne vide, chacune précédée d'un en-tête `Section,<nom>` :

| Section | Colonnes | Signification |
|---|---|---|
| Domaine | `domain` | Domaine vérifié chez Resend dans l'organisation source. À titre indicatif — jamais appliqué automatiquement, ne pas copier tel quel si le domaine cible diffère (voir §1). |
| Users | `username,email,nom,proEmail,orgRole,isDeptHead` | Utilisateurs de l'organisation source. **Jamais de mot de passe** — voir §4. |
| Mail Routes | `alias,personalEmail,displayName,active` | Une adresse `@domaine` (ex. `contact@...`) et l'adresse personnelle vers laquelle une copie de notification est transférée. |
| Routing Rules | `canal,assignToEmail,active` | Règle d'assignation automatique : tout thread reçu sur `canal` est assigné à l'utilisateur dont l'email est `assignToEmail`. |
| Reply Templates | `titre,canal,corps` | Modèle de réponse pré-rédigé, optionnellement limité à un canal (`canal` vide = tous les canaux). |

Encodage UTF-8 avec BOM (ouverture directe dans Excel/Sheets sans corruption des accents).

## 3. Correspondance selon l'architecture de la cible

**Cas A — cible générique multi-tenant (même architecture que ce repo)** : import automatisé via **Réglages → Importer un CSV**. Table à table, en upsert par clé métier (rien n'est jamais supprimé, un réimport est idempotent) :
- `Users` → `UserInvite` PENDING (jamais un `User` actif directement — voir §4). Une ligne dont l'email/username correspond déjà à un `User` ou à une invitation en attente est réutilisée ou ignorée, jamais dupliquée.
- `Mail Routes` → table `MailRoute` (alias + personalEmail + displayName + active).
- `Routing Rules` → table `ThreadRoutingRule`. `assignToEmail` est résolu dans l'ordre : (1) un `User` déjà actif dans la cible → appliqué immédiatement, avec le `SenderGrant` correspondant si l'alias du canal a été importé dans le même fichier ; (2) sinon une `UserInvite` PENDING de la cible (créée par la section `Users` de ce même import, ou déjà créée à la main) → mise en attente sur l'invitation, appliquée automatiquement dès que cette personne active son compte ; (3) sinon la ligne est ignorée.
- `Reply Templates` → table `ReplyTemplate`.

**Cas B — cible mono-tenant avec adresses de service codées en dur (ex. `jeprogroup-website` : `contact`/`rh`/`commercial` liés à des rôles métier fixes, pas de table Mail Route générique)** : pas d'import automatisable, procédure manuelle :
- Pour chaque ligne `Mail Routes`, vérifier si une adresse de service équivalente existe déjà dans la config codée en dur de la cible ; sinon, l'ajouter à la main dans le code (nouvelle constante/route) ou dans ses variables d'environnement, selon comment ce projet gère ses adresses.
- `Users`, `Routing Rules` et `Reply Templates` n'ont pas d'équivalent direct si la cible n'a pas ces concepts — à recréer manuellement si la fonctionnalité existe sous une autre forme, sinon à ignorer.

Dans le doute sur l'architecture de la cible, inspecter son schéma de données (`schema.prisma` ou équivalent) avant d'importer quoi que ce soit.

## 4. Ce qui n'est jamais exporté, et pourquoi

- **Clé API Resend** : chaque organisation a son propre compte Resend. Réutiliser la clé source dans une autre organisation ferait envoyer/recevoir les emails de la cible depuis le compte Resend de la source — jamais souhaitable.
- **Secret de signature du webhook** : lié à l'URL de webhook de l'organisation source (`{backendUrl}/api/inbound-mail/{webhookToken}`), inutilisable ailleurs.
- **Mot de passe** : jamais exporté, jamais importé. Une ligne `Users` importée devient une `UserInvite` **PENDING** — un placeholder inerte, pas un compte utilisable. Elle ne donne accès à rien tant qu'un admin de la cible n'a pas explicitement généré et transmis le fichier d'activation (`GET /user-invites/:id/file`) et le code (`POST /user-invites/:id/activation-code`), exactement comme pour une invitation créée à la main — deux actions séparées, deux canaux séparés. La personne migrée doit donc choisir un nouveau mot de passe à l'activation, comme n'importe quel nouvel utilisateur.

→ Ces éléments se reconfigurent/redistribuent normalement dans la cible (connexion Resend + création webhook cf. §1, activation individuelle cf. ci-dessus), jamais par copie depuis ce fichier.

## 5. Procédure recommandée

**Cas A (import automatisé) :**
1. Exporter le CSV depuis Réglages (organisation source), ou le constituer à la main selon le format du §2 si la source est un système tiers.
2. Sur l'organisation cible, s'assurer des prérequis du §1.
3. Réglages → Importer un CSV. Vérifier le résumé (créés / mis à jour / en attente d'activation / ignorés par section).
4. Pour chaque invitation créée (visible dans Invitations), envoyer le fichier d'activation et dicter le code à la personne concernée — ses Mail Routes / Routing Rules / SenderGrants pré-importés s'appliquent automatiquement dès qu'elle active son compte.
5. Vérifier qu'un email de test reçu sur chaque alias importé crée bien un thread assigné à la bonne personne côté cible avant de considérer la migration terminée.

**Cas B (procédure manuelle) :** identique aux étapes 1-2 puis recréer Mail Routes / Routing Rules / Reply Templates un par un selon la correspondance du §3.
