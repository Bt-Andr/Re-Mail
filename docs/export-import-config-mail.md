# Réutiliser un export de configuration mail dans un autre projet

Ce document explique comment prendre le CSV produit par **Réglages → Export de la configuration mail** (`GET /api/organizations/me/export`, OWNER/ADMIN) et l'appliquer dans un autre projet qui utilise aussi Resend (ex. `jeprogroup-website`, ou une autre organisation sur ce même produit).

Il n'existe pas d'import automatique : le format et l'architecture de la cible peuvent différer (voir §3). Ce doc sert de procédure manuelle.

## 1. Prérequis côté projet cible

Avant d'importer quoi que ce soit, le projet cible doit déjà avoir, avec **son propre** compte Resend (jamais celui de l'organisation source) :

1. Une clé API Resend connectée.
2. Un domaine vérifié chez Resend (peut être différent du domaine source).
3. Un webhook `email.received` créé dans le dashboard Resend cible, avec son propre secret de signature.

L'export ne contient volontairement aucun secret (clé API, secret de webhook) — voir §4. Sans ces trois prérequis en place, les alias importés ne recevront jamais rien.

## 2. Contenu et format du CSV

Le fichier est découpé en 4 sections, séparées par une ligne vide, chacune précédée d'un en-tête `Section,<nom>` :

| Section | Colonnes | Signification |
|---|---|---|
| Domaine | `domain` | Domaine vérifié chez Resend dans le projet source. À titre indicatif — ne pas copier tel quel si le domaine cible diffère. |
| Mail Routes | `alias,personalEmail,displayName,active` | Une adresse `@domaine` (ex. `contact@...`) et l'adresse personnelle vers laquelle une copie de notification est transférée. |
| Routing Rules | `canal,assignToEmail,active` | Règle d'assignation automatique : tout thread reçu sur `canal` est assigné à l'utilisateur dont l'email est `assignToEmail`. |
| Reply Templates | `titre,canal,corps` | Modèle de réponse pré-rédigé, optionnellement limité à un canal (`canal` vide = tous les canaux). |

Encodage UTF-8 avec BOM (ouverture directe dans Excel/Sheets sans corruption des accents).

## 3. Correspondance selon l'architecture du projet cible

**Cas A — projet cible générique multi-tenant (même architecture que ce repo)** : mapping direct, table à table.
- `Mail Routes` → table `MailRoute` (alias + personalEmail + displayName + active)
- `Routing Rules` → table `ThreadRoutingRule` (canal + assignToId — il faut résoudre `assignToEmail` vers l'`id` du `User` correspondant dans la cible ; s'il n'existe pas, créer l'utilisateur avant ou ignorer la ligne)
- `Reply Templates` → table `ReplyTemplate`

**Cas B — projet cible mono-tenant avec adresses de service codées en dur (ex. `jeprogroup-website` : `contact`/`rh`/`commercial` liés à des rôles métier fixes, pas de table Mail Route générique)** : pas d'import automatisable. Utiliser le CSV comme simple référence :
- Pour chaque ligne `Mail Routes`, vérifier si une adresse de service équivalente existe déjà dans la config codée en dur de la cible ; sinon, l'ajouter à la main dans le code (nouvelle constante/route) ou dans ses variables d'environnement, selon comment ce projet gère ses adresses.
- Les `Routing Rules` et `Reply Templates` n'ont pas d'équivalent direct si la cible n'a pas ces concepts — à recréer manuellement si la fonctionnalité existe sous une autre forme, sinon à ignorer.

Dans le doute sur l'architecture de la cible, inspecter son schéma de données (`schema.prisma` ou équivalent) avant d'importer quoi que ce soit.

## 4. Ce qui n'est jamais exporté, et pourquoi

- **Clé API Resend** : chaque organisation/projet a son propre compte Resend. Réutiliser la clé source dans un autre projet ferait envoyer/recevoir les emails de la cible depuis le compte Resend de la source — jamais souhaitable.
- **Secret de signature du webhook** : lié à l'URL de webhook du projet source (`{backendUrl}/api/inbound-mail/{webhookToken}`), inutilisable ailleurs.

→ Ces deux éléments se reconfigurent normalement dans la cible (connexion Resend + création webhook, cf. §1), jamais par copie depuis ce fichier.

## 5. Procédure recommandée

1. Exporter le CSV depuis Réglages (organisation source).
2. Sur le projet cible, s'assurer des prérequis du §1.
3. Identifier le cas A ou B (§3) selon l'architecture de la cible.
4. Importer/recréer les Mail Routes, Routing Rules et Reply Templates un par un (ou via un script d'import ad hoc si le cas A s'applique et que le volume le justifie).
5. Vérifier qu'un email de test reçu sur chaque alias importé crée bien un thread/route côté cible avant de considérer la migration terminée.
