# Plan de patch — fiabilisation de Re-Mail

## Objectif

Amener Re-Mail à un niveau où les parcours personnels et collaboratifs peuvent être utilisés sans risque silencieux de perte, de duplication, de fusion ou de mauvais classement des emails, puis rendre l’administration accessible à un utilisateur non technique.

Ce plan découle de l’audit du backend, des clients web et mobile, du dashboard plateforme et de la suite automatisée. Au moment de l’audit, les contrôles TypeScript et les builds étaient valides, et les 167 tests backend réussissaient.

## Principes d’exécution

- Livrer des lots indépendants, testables et réversibles.
- Ajouter les tests de non-régression avant ou avec chaque correction.
- Ne jamais affaiblir le scoping multi-tenant fourni par `forOrg(organizationId)`.
- Ne jamais accuser réception d’un email avant d’avoir garanti sa reprise.
- Déployer les changements de schéma avant le code qui les consomme.
- Conserver une compatibilité transitoire avec les fils et messages existants.
- Ne créer un commit qu’à la demande explicite du propriétaire du dépôt.

## Lot 0 — Préparer les migrations et la ligne de base

### Objectif

Garantir qu’une migration peut être appliquée et reproduite sur une base neuve avant de modifier le modèle de données.

### Travaux

- Recréer proprement la base Docker jetable ou baseliner son schéma existant.
- Vérifier que les 10 migrations actuelles s’appliquent depuis une base vide.
- Documenter la commande locale de remise à zéro de la base de test.
- Ajouter une vérification de l’état des migrations à la procédure de validation.

### Critères d’acceptation

- `prisma migrate status` indique que le schéma est à jour.
- Une base vide peut être construite uniquement à partir des migrations versionnées.
- Les 167 tests existants restent verts.

## Lot 1 — Rendre la réception durable et idempotente

### Objectif

Éliminer les pertes silencieuses et le double traitement des événements entrants.

### Modèle proposé

Ajouter un modèle Prisma `InboundEvent` comprenant au minimum :

- `id` ;
- `organizationId` ;
- `provider` (`resend`, puis extensible) ;
- `externalId` ;
- `status` (`pending`, `processing`, `completed`, `failed`) ;
- données nécessaires au retraitement ou payload sérialisé ;
- `attemptCount` ;
- `lastError` ;
- `processedAt`, `createdAt`, `updatedAt`.

Une contrainte unique doit empêcher deux événements identiques pour le même fournisseur et la même organisation.

### Webhook Resend

- Vérifier le token d’organisation et la signature Svix.
- Extraire et valider l’identifiant externe de l’événement.
- Enregistrer l’événement de façon idempotente.
- Retourner `200` uniquement lorsque l’événement est durablement enregistré.
- Traiter l’événement enregistré dans un service séparé.
- Ignorer proprement un événement déjà terminé.
- Permettre la reprise des événements `pending` et `failed`.
- Ne jamais conserver de secrets dans le payload ou les logs.

### Polling IMAP

- Ajouter un verrou en mémoire empêchant deux cycles locaux de se chevaucher.
- Ajouter un verrou distribué ou une revendication atomique avant un déploiement multi-instance.
- Enregistrer un identifiant de message unique avant de faire avancer le curseur UID.
- Conserver la possibilité de reprendre une connexion passée en erreur.
- Lancer un premier cycle contrôlé au démarrage, sans attendre tout l’intervalle.

### Organisation du code

- Extraire le traitement métier de `src/routes/mail.ts` vers un service tel que `src/services/inboundProcessor.ts`.
- Garder la route HTTP limitée à l’authentification du webhook et à la persistance de l’événement.
- Centraliser le traitement Resend et IMAP autour d’un résultat explicite et journalisable.

### Tests obligatoires

- Répétition exacte du même webhook.
- Deux traitements concurrents du même événement.
- Échec de la base avant l’accusé de réception.
- Échec du traitement après persistance, puis reprise réussie.
- Redémarrage avec un événement `pending`.
- Chevauchement de deux cycles IMAP.
- Deux instances simulées revendiquant le même message.

## Lot 2 — Corréler correctement les conversations

### Objectif

Éviter que des échanges indépendants soient fusionnés parce qu’ils ont le même expéditeur.

### Données à ajouter

Ajouter aux messages ou à une table de correspondance :

- `providerMessageId` ;
- `internetMessageId` ;
- `inReplyTo` ;
- `references` ;
- `sourceId` ou la connexion source lorsque nécessaire.

Créer les index et contraintes d’unicité compatibles avec plusieurs organisations et fournisseurs.

### Règle de corrélation

Appliquer les critères dans cet ordre :

1. token de réponse Re-Mail valide ;
2. correspondance `In-Reply-To` ;
3. correspondance dans `References` ;
4. identifiant fournisseur déjà traité ;
5. à défaut, création d’une nouvelle conversation.

Le couple expéditeur + canal ne doit plus suffire à rattacher un message.

### Cas particuliers

- Une boîte IMAP/Gmail doit toujours être distinguée par `connection.id`.
- Deux sujets du même expéditeur doivent produire deux fils s’ils ne partagent aucun en-tête de réponse.
- Une vraie réponse peut conserver le fil même si le sujet a changé.
- Les anciens fils dépourvus de métadonnées doivent rester lisibles.

### Clarification des tokens de réponse

Ajouter un usage explicite au token :

- `forwarded-to-agent` : la réponse du collaborateur doit être relayée au client ;
- `outbound-to-client` : la réponse du client doit seulement être enregistrée dans Re-Mail et notifier l’équipe.

Cela empêche qu’une réponse client soit renvoyée au même client comme un écho.

### Tests obligatoires

- Deux sujets différents du même expéditeur.
- Même expéditeur vers deux boîtes connectées.
- Réponse avec `In-Reply-To`.
- Réponse avec uniquement `References`.
- Message sans en-tête de réponse.
- Webhook rejoué.
- Réponse d’un collaborateur depuis une boîte de transfert.
- Réponse d’un client à un message envoyé depuis Re-Mail.

## Lot 3 — Corriger le classement des comptes et dossiers

### Objectif

Afficher chaque fil dans la bonne identité, la bonne boîte et le bon dossier.

### Travaux backend

- Lors d’un nouvel envoi SMTP, enregistrer `sourceId = mailbox.id` et `sourceType = mailbox.provider`.
- Réserver `sourceId = null` aux messages et fils réellement gérés par Resend.
- Décider et documenter la sémantique de « Réception » et « Envoyés » :
  - soit une conversation peut apparaître dans les deux dossiers selon ses messages ;
  - soit elle possède un emplacement principal qui change lors d’une nouvelle réponse entrante.
- Faire remonter les fils initialement sortants lorsqu’une réponse entrante non lue arrive.
- Recalculer les compteurs non lus selon la même règle.

### Travaux clients

- Aligner webmail et mobile sur la nouvelle sémantique.
- Invalider les listes concernées après envoi, réception, archivage et changement de boîte.
- Préserver le fil sélectionné lors d’un rafraîchissement si son emplacement reste valide.

### Tests obligatoires

- Nouveau mail depuis Gmail.
- Nouveau mail depuis une connexion IMAP générique.
- Nouveau mail depuis Resend.
- Réponse entrante sur un fil initialement sortant.
- Filtres « Toutes les boîtes », Resend et boîte externe.
- Compteur non lu après réception et après ouverture.
- Parité webmail/mobile.

## Lot 4 — Renforcer l’intégrité multi-tenant et la validation

### Objectif

Faire respecter les invariants même lorsqu’un client appelle directement l’API avec un payload forgé.

### Références relationnelles

Avant toute mutation, vérifier dans le client Prisma scopé que la cible appartient à l’organisation :

- utilisateur assigné à un fil ;
- utilisateur assigné à une règle de routage ;
- utilisateur recevant un `SenderGrant` ;
- message source d’un transfert ;
- toute nouvelle relation acceptant un identifiant client.

Centraliser ces vérifications dans des helpers pour éviter des implémentations divergentes.

### Validation structurée

Introduire des schémas de validation partagés, idéalement avec Zod, pour :

- inscription et connexion ;
- création et mise à jour d’utilisateurs ;
- invitations ;
- envoi, réponse et transfert d’emails ;
- domaines, alias et règles de routage ;
- pagination, recherche et actions groupées ;
- connexions IMAP/SMTP.

### Contraintes minimales

- Mot de passe d’au moins huit caractères côté serveur.
- Destinataires principaux valides et bornés.
- `message` obligatoirement textuel.
- Longueurs maximales pour noms, sujets, corps, alias et champs libres.
- Pagination bornée, par exemple `take` entre 1 et 100.
- Alias conforme au domaine Resend sélectionné.
- Domaine sélectionné présent et vérifié dans le compte Resend connecté.
- Secret webhook conforme au format attendu.
- Valeurs HTML échappées dans les emails de notification internes.

### Gestion des erreurs

- Retourner `400` pour un payload invalide.
- Retourner `404` sans révéler une ressource d’un autre tenant.
- Réserver `500` aux erreurs réellement internes.
- Éviter de renvoyer directement les messages bruts des bibliothèques IMAP, SMTP ou Resend.

### Tests obligatoires

- Assignation à un utilisateur d’un autre tenant.
- `SenderGrant` cross-tenant.
- Domaine absent du compte Resend.
- Alias hors domaine ou mal formé.
- Corps non textuel ou absent.
- Mot de passe trop court.
- Pagination négative ou excessive.
- Injection HTML dans noms, sujets et notifications.

## Lot 5 — Sécuriser les comptes et rôles

### Objectif

Éviter qu’une organisation perde son propriétaire et permettre la récupération normale d’un compte.

### Propriété et administration

- Empêcher la suppression ou la rétrogradation du dernier `OWNER`.
- Réserver au propriétaire :
  - la promotion d’un autre utilisateur vers `OWNER` ;
  - la suppression ou rétrogradation d’un autre propriétaire ;
  - le transfert explicite de propriété.
- Documenter clairement les différences entre `OWNER` et `ADMIN`.
- Ajouter les contraintes transactionnelles nécessaires pour éviter une course entre deux mutations.

### Mot de passe et sessions

- Ajouter le changement de mot de passe authentifié.
- Ajouter « mot de passe oublié » avec jeton court, expirant, hashé et à usage unique.
- Ne jamais révéler si une adresse existe lors de la demande de réinitialisation.
- Révoquer les sessions après un changement de mot de passe ou une compromission.
- Prévoir un numéro de version de session ou une table de sessions révocables.

### Tests obligatoires

- Suppression du dernier propriétaire refusée.
- Rétrogradation du dernier propriétaire refusée.
- Transfert de propriété atomique.
- Demande de réinitialisation non énumérable.
- Jeton expiré, rejoué ou falsifié.
- Ancien JWT refusé après révocation.

## Lot 6 — Rendre l’onboarding accessible

### Objectif

Permettre à un administrateur non spécialiste de savoir si sa messagerie fonctionne réellement.

### Assistant Resend

Transformer la configuration en parcours vérifié :

1. connexion de la clé API ;
2. sélection parmi les seuls domaines réellement vérifiés ;
3. instructions adaptées pour les DNS/MX ;
4. création ou configuration du webhook ;
5. test automatique du webhook ;
6. création de la première adresse ;
7. envoi d’un email test ;
8. confirmation de réception ;
9. écran final « Configuration opérationnelle ».

Afficher séparément les états suivants :

- clé API valide ;
- domaine vérifié ;
- webhook configuré ;
- webhook testé ;
- au moins une adresse d’envoi disponible ;
- dernière réception réussie.

### Assistant IMAP/SMTP

- Expliquer les mots de passe d’application.
- Fournir des instructions propres à Gmail, Outlook, Yahoo et aux connexions manuelles.
- Distinguer les erreurs d’identifiants, de TLS, d’IMAP et de SMTP.
- Permettre de ressaisir les identifiants lors d’une reconnexion.
- Ne pas remettre une connexion en état `connected` avant un nouveau test réussi.

### Tests d’expérience

- Test end-to-end de création d’un compte personnel.
- Création d’une entreprise depuis une identité personnelle.
- Invitation, téléchargement, code et activation.
- Connexion d’une boîte et envoi d’un premier message.
- Configuration Resend complète avec test de réception.
- Erreur réseau, session expirée et reprise du parcours.

## Lot 7 — Finition des produits clients

### Web et webmail

- Ajouter une suite end-to-end sur les parcours critiques.
- Vérifier le clavier, le focus des modales, les labels et les lecteurs d’écran.
- Remplacer les alertes natives restantes par les composants cohérents du produit.
- Ajouter une page de diagnostic compréhensible pour les connexions mail.

### Mobile

- Ajouter un état hors ligne explicite.
- Persister le cache utile et définir sa politique d’expiration.
- Afficher l’état des notifications push et proposer une action corrective.
- Vérifier les liens profonds d’activation et de notification sur Android et iOS.
- Définir explicitement les variables du profil EAS de production.

### Dashboard plateforme

- Masquer ou supprimer de la navigation les pages bancaires factices.
- Ne conserver que les fonctions Re-Mail réellement branchées.
- Ajouter progressivement les opérations de support avec journal d’audit.

## Stratégie de livraison

### Cycle 1 — Confiance dans le courrier

Livrer les lots 0 à 3. Ce cycle est bloquant avant une ouverture à des utilisateurs réels.

### Cycle 2 — Sécurité applicative

Livrer les lots 4 et 5. Ce cycle rend l’API robuste face aux appels directs et aux incidents de compte.

### Cycle 3 — Adoption utilisateur

Livrer les lots 6 et 7. Ce cycle réduit la dépendance au support et termine les surfaces visibles.

## Série indicative de commits

```text
chore(db): restore a reproducible migration baseline
fix(inbound): persist and deduplicate Resend webhook events
fix(imap): prevent concurrent polling and duplicate ingestion
fix(threads): correlate messages using email reply headers
fix(reply): distinguish forwarded-agent and client reply tokens
fix(accounts): bind outbound SMTP threads to their mailbox
fix(threads): surface replies to outbound conversations
fix(authz): validate all tenant-bound relation identifiers
fix(validation): enforce email, domain and password contracts
fix(roles): protect ownership invariants
feat(auth): add password reset and session revocation
feat(onboarding): add verified setup and delivery checks
test(e2e): cover critical user journeys
chore(admin): hide unfinished platform placeholders
```

## Définition globale de « terminé »

Le programme de fiabilisation est terminé lorsque :

- aucune entrée email ne peut être perdue après son accusé de réception ;
- un même message ne peut être traité qu’une fois ;
- la corrélation repose sur les identifiants et en-têtes de réponse ;
- chaque fil apparaît dans la bonne identité et le bon dossier ;
- toutes les relations fournies par le client sont validées dans le tenant ;
- un propriétaire ne peut pas rendre son organisation orpheline ;
- un utilisateur peut récupérer son compte sans intervention technique ;
- l’onboarding confirme par un test réel que l’envoi et la réception fonctionnent ;
- les tests unitaires, d’intégration et end-to-end critiques sont verts ;
- les migrations sont reproductibles depuis une base vide ;
- les documentations utilisateur et d’exploitation correspondent au produit livré.

