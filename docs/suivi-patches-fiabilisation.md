# Suivi des patches de fiabilisation

Document de pilotage associé à [patch-plan-fiabilisation.md](./patch-plan-fiabilisation.md).

## État global

| Champ | Valeur |
|---|---|
| Programme | Fiabilisation de Re-Mail |
| Statut | En cours — lots 2 et 3 terminés, lots 1 et 4 actifs |
| Dernière mise à jour | 2026-09-15 |
| Branche de référence | `main` |
| Baseline fonctionnelle | 30 fichiers de tests, 201 tests réussis |
| Responsable | À renseigner |
| Version cible | À renseigner |

## Légende

- `[ ]` À faire
- `[~]` En cours
- `[x]` Terminé et vérifié
- `[!]` Bloqué
- `[-]` Hors périmètre ou abandonné

## Vue d’ensemble

| Lot | Sujet | Priorité | Statut | Dépend de | Critère de sortie principal |
|---:|---|---|---|---|---|
| 0 | Baseline des migrations | Bloquante | Terminé | — | Base reconstruite uniquement par migrations |
| 1 | Réception durable et idempotente | Critique | En cours | 0 | Aucun événement perdu ou traité deux fois |
| 2 | Corrélation des conversations | Critique | Terminé | 0, 1 | Aucun regroupement fondé seulement sur l’expéditeur |
| 3 | Classement comptes et dossiers | Haute | Terminé | 2 | Fils visibles dans la bonne boîte et le bon dossier |
| 4 | Intégrité tenant et validation | Critique | En cours | 0 | Aucune relation cross-tenant acceptée |
| 5 | Comptes et rôles | Haute | À faire | 0, 4 | Dernier propriétaire protégé et récupération disponible |
| 6 | Onboarding vérifié | Haute | À faire | 1–5 | Test réel d’envoi/réception réussi dans l’assistant |
| 7 | Finition des clients | Moyenne | À faire | 3–6 | Parcours critiques couverts en end-to-end |

## Lot 0 — Baseline des migrations

Statut : **Terminé — 2026-09-07**

- [x] Choisir entre recréation de la base Docker et baseline contrôlée.
- [x] Éviter toute opération destructive : comparaison puis baseline contrôlée.
- [x] Vérifier les migrations actuelles sur une base vide.
- [x] Comparer la base historique et la base migrée — aucune différence SQL.
- [x] Enregistrer les 10 migrations sur la base locale existante.
- [x] Obtenir un `prisma migrate status` propre.
- [x] Documenter la création, la vérification et la remise à zéro explicite de la base de test.
- [x] Relancer les tests backend.

Validation :

- [x] Typecheck backend réussi lors de la baseline d’audit.
- [x] Build backend réussi lors de la baseline d’audit.
- [x] 167 tests existants réussis sur la base reconstruite par migrations.
- [x] 167 tests existants réussis sur la base habituelle baselinée.
- [x] Aucune modification involontaire du schéma généré.

## Lot 1 — Réception durable et idempotente

Statut : **En cours — durabilité et reprise validées, extraction métier restante**

- [x] Définir le schéma `InboundEvent`.
- [x] Créer la migration et régénérer Prisma Client.
- [~] Extraire le traitement entrant dans un service — orchestration extraite, traitement métier Resend encore dans `routes/mail.ts`.
- [x] Persister avant l’accusé de réception HTTP.
- [x] Ajouter la revendication atomique d’un événement.
- [x] Ajouter les statuts et compteurs de tentatives.
- [x] Ajouter la reprise des événements échoués.
- [x] Dédupliquer les identifiants Svix/Resend.
- [x] Dédupliquer les identifiants IMAP par connexion, UIDVALIDITY et UID.
- [x] Ajouter un verrou local au poller.
- [x] Définir la stratégie multi-instance — revendication atomique par événement pour Resend et IMAP ; les connexions IMAP concurrentes restent possibles mais un seul traitement métier est autorisé.
- [x] Ne journaliser ni secret ni payload dans le nouveau processeur.

Validation :

- [x] Test de webhook dupliqué.
- [x] Test de concurrence sur la création et la revendication.
- [x] Test de panne de persistance avant accusé de réception — réponse `500`, aucun faux ACK.
- [x] Test de reprise après panne du handler.
- [x] Test de redémarrage avec reprise d’un événement `pending`.
- [x] Test de chevauchement du poller local.

## Lot 2 — Corrélation des conversations

Statut : **Terminé — 2026-09-10**

- [x] Définir les nouvelles métadonnées email.
- [x] Créer la migration correspondante.
- [x] Parser `Message-ID`, `In-Reply-To` et `References` côté IMAP.
- [x] Récupérer ou conserver les mêmes métadonnées côté Resend.
- [x] Implémenter la règle de corrélation ordonnée : `In-Reply-To`, `References`, puis fallback historique prudent.
- [x] Retirer le rattachement par expéditeur + canal seul — le fallback exige aussi la boîte source et le sujet normalisé.
- [x] Inclure la boîte source dans toute corrélation personnelle et isoler les fils Resend (`sourceId = null`).
- [x] Ajouter le type d’usage aux tokens de réponse (`conversation`, `forward_bridge`, compatibilité `legacy`).
- [x] Empêcher l’écho d’une réponse client tout en conservant les ponts de transfert.
- [x] Préserver la lecture et le rattachement prudent des fils historiques sans métadonnées.

Validation :

- [x] Même expéditeur, deux sujets indépendants.
- [x] Même expéditeur, deux boîtes différentes (IMAP ↔ IMAP et IMAP ↔ Resend).
- [x] Réponse `In-Reply-To`.
- [x] Réponse `References`.
- [x] Message sans métadonnées, avec fallback sur le sujet normalisé.
- [x] Transfert collaborateur vers client.
- [x] Réponse client vers Re-Mail, enregistrée sans auto-renvoi.

## Lot 3 — Comptes et dossiers

Statut : **Terminé — 2026-09-10**

- [x] Enregistrer `sourceId` lors d’un envoi SMTP.
- [x] Enregistrer `sourceType` lors d’un envoi SMTP.
- [x] Réserver `sourceId = null` à Resend pour les nouveaux fils sortants.
- [x] Restreindre les fils d’une boîte externe à son propriétaire, y compris face aux managers de l’organisation.
- [x] Valider la sémantique produit de Réception/Envoyés — un fil mixte apparaît dans les deux vues.
- [x] Implémenter le retour visible d’une réponse sur un fil sortant.
- [x] Aligner les compteurs non lus — affichés dans Réception, neutralisés dans Envoyés.
- [x] Aligner les filtres backend sur la direction réelle des messages, avec compatibilité des fils historiques.
- [x] Rafraîchir le webmail et ouvrir un nouveau message dans Envoyés après envoi.
- [x] Invalider les caches mobiles concernés — la clé racine `threads` couvre tous les dossiers.

Validation :

- [x] Envoi Gmail/IMAP classé dans la boîte sélectionnée au niveau backend.
- [x] Envoi Resend classé dans Resend au niveau backend.
- [x] Réponse entrante visible et non lue dans Réception, sans badge non-lu dans Envoyés.
- [x] Filtres multi-boîtes cohérents avec les dossiers mixtes.
- [x] Contrôles TypeScript réussis sur webmail et mobile.

## Lot 4 — Intégrité tenant et validation

Statut : **En cours — relations utilisateur critiques et entrées de messagerie contrôlées**

- [ ] Créer les schémas de validation partagés.
- [x] Vérifier le tenant de l’utilisateur assigné à un fil.
- [x] Vérifier le tenant de l’utilisateur assigné à une règle.
- [x] Vérifier le tenant du bénéficiaire d’un `SenderGrant`.
- [x] Refuser une réponse associée à un fil absent, cross-tenant ou lié à la boîte personnelle d’un autre utilisateur avant tout envoi.
- [x] Vérifier le fil du message source d’un transfert avant tout effet de bord.
- [x] Borner la pagination des fils (`take` 1–100, `skip` 0–100000).
- [x] Valider le destinataire principal avant tout effet de bord.
- [x] Valider les longueurs du sujet et du corps avant tout effet de bord.
- [ ] Imposer la politique de mot de passe côté serveur.
- [ ] Vérifier le domaine auprès de Resend.
- [ ] Valider les alias contre le domaine.
- [ ] Valider le format du secret webhook.
- [ ] Échapper les valeurs des notifications HTML.
- [ ] Uniformiser les réponses `400`, `404` et `500`.

Validation :

- [~] Tests cross-tenant négatifs — affectation, routage, autorisation d’expéditeur, réponse et source de transfert couverts ; inventaire restant à poursuivre.
- [~] Tests de payloads malformés — envoi et identifiants relationnels couverts ; autres routes à inventorier.
- [x] Tests de limites de taille de l’envoi et de pagination des fils.
- [ ] Tests de domaine et alias.
- [ ] Tests d’échappement HTML.

## Lot 5 — Comptes et rôles

Statut : **À faire**

- [ ] Définir la matrice de permissions `OWNER`/`ADMIN`/`MEMBER`.
- [ ] Protéger le dernier propriétaire.
- [ ] Ajouter un transfert de propriété atomique.
- [ ] Ajouter le changement de mot de passe.
- [ ] Ajouter la demande de réinitialisation.
- [ ] Ajouter le jeton expirant à usage unique.
- [ ] Ajouter la révocation des sessions.
- [ ] Ajouter les interfaces web et mobile associées.

Validation :

- [ ] Dernier propriétaire impossible à supprimer.
- [ ] Dernier propriétaire impossible à rétrograder.
- [ ] Transfert concurrent sans organisation orpheline.
- [ ] Réinitialisation non énumérable.
- [ ] Jeton expiré ou rejoué refusé.
- [ ] Anciennes sessions révoquées.

## Lot 6 — Onboarding vérifié

Statut : **À faire**

- [ ] Concevoir l’état détaillé de configuration.
- [ ] Afficher uniquement les domaines vérifiés.
- [ ] Ajouter les instructions DNS/MX contextualisées.
- [ ] Ajouter le test du webhook.
- [ ] Ajouter la création guidée de la première adresse.
- [ ] Ajouter l’envoi d’un email test.
- [ ] Ajouter la confirmation de réception.
- [ ] Ajouter un écran final opérationnel.
- [ ] Améliorer les instructions IMAP/SMTP par fournisseur.
- [ ] Permettre de ressaisir les identifiants d’une connexion en erreur.
- [ ] Ne déclarer une reconnexion réussie qu’après test IMAP et SMTP.

Validation :

- [ ] Parcours Resend réalisé sans aide externe autre que les actions DNS nécessaires.
- [ ] Parcours Gmail réalisé par OAuth.
- [ ] Parcours Outlook/Yahoo réalisé avec instructions adaptées.
- [ ] Chaque échec propose une action corrective compréhensible.

## Lot 7 — Finition des clients

Statut : **À faire**

- [ ] Installer et configurer les tests end-to-end web.
- [ ] Couvrir création, connexion, activation et changement de compte.
- [ ] Couvrir envoi, réception, réponse, transfert et pièces jointes.
- [ ] Effectuer l’audit clavier et focus.
- [ ] Compléter les labels accessibles.
- [ ] Remplacer les alertes natives restantes.
- [ ] Ajouter le statut hors ligne mobile.
- [ ] Définir la persistance du cache mobile.
- [ ] Afficher le statut des notifications push.
- [ ] Vérifier les liens profonds Android et iOS.
- [ ] Définir les variables EAS de production.
- [ ] Masquer les pages factices du dashboard plateforme.

Validation :

- [ ] Tests end-to-end critiques verts.
- [x] Contrôle TypeScript des quatre applications vert.
- [ ] Builds de production verts.
- [ ] Aucun écran factice accessible depuis la navigation de production.

## Matrice de validation à exécuter après chaque lot

| Contrôle | Commande ou méthode | Résultat attendu |
|---|---|---|
| État Git | `git status --short` | Seulement les fichiers attendus |
| Backend types | `npm run typecheck` | Succès |
| Backend build | `npm run build` | Succès |
| Tests backend | `npm test` | Tous réussis |
| Web admin | `npm run build --workspace=web` | Succès |
| Webmail | `npm run build --workspace=webmail` | Succès |
| Mobile | `npx tsc --noEmit -p mobile/tsconfig.json` | Succès |
| Dashboard types | `npm run typecheck` dans `Dashboard/` | Succès |
| Dashboard lint | `npm run lint` dans `Dashboard/` | Succès sans erreur ni avertissement |
| Dashboard build | `npm run build` dans `Dashboard/` | Succès |
| Migrations | `prisma migrate status` | Schéma à jour |
| Parcours ciblé | Test manuel ou end-to-end | Critères du lot validés |

Sous Windows avec une politique PowerShell restrictive, utiliser `npm.cmd` et `npx.cmd`.

## Registre des risques

| ID | Risque | Impact | Probabilité | Réduction prévue | État |
|---|---|---|---|---|---|
| R-01 | Perte d’un webhook après réponse `200` | Critique | Moyenne | Lot 1, persistance avant ACK | Ouvert |
| R-02 | Double traitement d’un email | Haute | Moyenne | Lots 1 et 2, idempotence | Ouvert |
| R-03 | Fusion de conversations indépendantes | Haute | Haute | Lot 2, en-têtes email | Réduit et couvert |
| R-04 | Mauvaise boîte ou mauvais dossier | Haute | Haute | Lot 3 | Réduit et couvert |
| R-05 | Relation cross-tenant forgée | Critique | Faible à moyenne | Lot 4 | En réduction |
| R-06 | Organisation sans propriétaire | Haute | Moyenne | Lot 5 | Ouvert |
| R-07 | Configuration déclarée terminée mais inactive | Haute | Haute | Lot 6, tests réels | Ouvert |
| R-08 | Régression non détectée dans les interfaces | Moyenne | Haute | Lot 7, end-to-end | Ouvert |
| R-09 | Migration impossible sur certains environnements | Haute | Moyenne | Lot 0 | Ouvert |

## Décisions à prendre

| ID | Décision | Options | Choix | Date |
|---|---|---|---|---|
| D-01 | Technologie de file durable | Table PostgreSQL / service de queue | À décider | — |
| D-02 | Verrou multi-instance du poller | Verrou PostgreSQL / worker unique / queue | À décider | — |
| D-03 | Sémantique Réception/Envoyés | Fils dans plusieurs vues / emplacement principal | Fils dans plusieurs vues selon les directions présentes | 2026-09-10 |
| D-04 | Durée de conservation des événements entrants | 30 / 90 / 180 jours | À décider | — |
| D-05 | Politique de mot de passe | Minimum simple / règles renforcées | À décider | — |
| D-06 | Stockage et révocation des sessions | Version utilisateur / table de sessions | À décider | — |

## Journal d’avancement

Ajouter une entrée à chaque session de travail significative.

| Date | Lot | Travail réalisé | Validation | Prochaine action | Auteur |
|---|---:|---|---|---|---|
| 2026-09-07 | — | Création du plan et du document de suivi | Documents relus | Démarrer le lot 0 | Codex |
| 2026-09-07 | 0 | Rejeu des 10 migrations sur une base vide, comparaison des schémas, baseline non destructive de `resend_mail_test` et documentation | Schémas identiques, migration à jour, 167/167 tests sur les deux bases | Démarrer le lot 1 | Codex |
| 2026-09-07 | 1 | Ajout du journal durable `InboundEvent`, déduplication Svix, revendication atomique, reprise périodique et verrou local IMAP | 11 migrations depuis zéro, typecheck/build backend, 172/172 tests | Dédupliquer les messages IMAP et extraire le traitement métier | Codex |
| 2026-09-07 | 1 | Liaison unique entre événement entrant et message, identité IMAP connexion/UIDVALIDITY/UID et protection du curseur | 12 migrations depuis zéro, typecheck/build backend, 175/175 tests | Rendre les effets métier partiels entièrement reprenables | Codex |
| 2026-09-07 | 3 | Classement des nouveaux fils SMTP par boîte source et isolation stricte des fils de boîtes personnelles entre utilisateurs d’une même organisation | Typecheck et tests backend complets | Corriger la visibilité des réponses sur les fils sortants | Codex |
| 2026-09-07 | 4 | Validation du tenant des affectations, règles de routage et autorisations d’expéditeur ; arrêt des réponses sur fil inaccessible avant envoi | Tests ciblés d’isolation réussis | Étendre la validation structurée des payloads | Codex |
| 2026-09-07 | 4 | Validation préalable de l’envoi, limites de sujet/corps, réponses HTTP 400/413 et pagination bornée | Typecheck/build backend, 187/187 tests | Centraliser les schémas de validation des autres routes | Codex |
| 2026-09-09 | 2 | Ajout systématique de la boîte source à la recherche d’un fil actif, avec séparation explicite de Resend | Tests ciblés IMAP et webhook réussis | Ajouter `Message-ID`, `In-Reply-To` et `References` | Codex |
| 2026-09-10 | 2 | Métadonnées RFC 5322, corrélation ordonnée, fallback par sujet normalisé et en-têtes de réponse SMTP | 13 migrations depuis zéro, typecheck/build backend, 196/196 tests | Typage des tokens puis finalisation Réception/Envoyés | Codex |
| 2026-09-10 | 3 | Dossiers calculés depuis les messages du fil, non-lus limités à Réception et navigation post-envoi corrigée | Typecheck/build backend, 197/197 tests, builds webmail et mobile valides | Finaliser les tokens de réponse et les scénarios de transfert | Codex |
| 2026-09-10 | 2 | Typage des tokens de conversation et de pont, suppression de l’écho client et conservation du relais collaborateur | 14 migrations depuis zéro, typecheck/build backend, 199/199 tests | Reprendre les dernières garanties du lot 1 | Codex |
| 2026-09-10 | — | Remise au vert du quality gate Dashboard : ordre stable des hooks, formatage et configuration explicite des exports Fast Refresh | Lint, typecheck et build Dashboard | Reprendre le lot 4 | Codex |
| 2026-09-15 | 4 | Validation anticipée du message source d’un transfert, avec contrôle du tenant et de l’appartenance au fil avant création du token | Typecheck/build backend, 201/201 tests | Centraliser les schémas de validation | Codex |

## Journal des validations

| Date | Révision | Tests backend | Builds clients | Migration | Parcours manuel | Notes |
|---|---|---:|---|---|---|---|
| 2026-09-05 | Avant patches | 167/167 | Backend, web, webmail, mobile et dashboard valides | Historique absent sur la base Docker existante | Smoke HTTP valide | Baseline d’audit |
| 2026-09-07 | Lot 0 | 167/167 | Inchangés | 10/10 migrations rejouées et baseline locale restaurée | Non requis | Aucun écart entre le schéma historique et le schéma migré |
| 2026-09-07 | Lot 1 — tranche 1 | 172/172 | Backend typecheck et build valides | 11/11 migrations rejouées depuis zéro | Couvert par intégration webhook | Double livraison Svix et double cycle local couverts |
| 2026-09-07 | Lot 1 — tranche 2 | 175/175 | Backend typecheck et build valides | 12/12 migrations rejouées depuis zéro | Retry IMAP avec curseur périmé couvert | Un événement ne peut créer qu’un seul `ThreadMessage` |
| 2026-09-07 | Lot 3 — tranche 1 | 176/176 | Backend typecheck et build valides | Sans migration | Classement SMTP et accès multi-utilisateur couverts par intégration | `sourceId` identifie désormais la boîte externe propriétaire |
| 2026-09-07 | Lot 4 — tranche 1 | 179/179 | Backend typecheck et build valides | Sans migration | Tentatives cross-tenant couvertes par intégration | Les trois relations utilisateur exposées par l’API sont validées avant écriture |
| 2026-09-07 | Lot 4 — tranche 2 | 187/187 | Backend typecheck et build valides | Sans migration | Entrées email et pagination couvertes par intégration | Les rejets ont lieu avant création de fil et avant appel au fournisseur |
| 2026-09-09 | Lot 2 — tranche 1 | 189/189 | Backend typecheck et build valides | Sans migration | Collisions IMAP/IMAP et IMAP/Resend couvertes | La corrélation reste imparfaite sans en-têtes standards, mais ne traverse plus les boîtes |
| 2026-09-10 | Lot 2 — tranche 2 | 196/196 | Backend typecheck et build valides | 13/13 migrations rejouées depuis zéro | `In-Reply-To`, `References`, sujets indépendants et fallback historique couverts | Les réponses SMTP émettent et conservent les en-têtes de threading |
| 2026-09-10 | Lot 3 — tranche 2 | 197/197 | Backend, webmail et mobile valides | 13/13 déjà validées | Fil mixte visible dans Réception et Envoyés | Le webmail ouvre les nouveaux fils directement dans Envoyés |
| 2026-09-10 | Lot 2 — tranche 3 | 199/199 | Backend typecheck et build valides | 14/14 migrations rejouées depuis zéro | Conversation sans écho et pont de transfert couverts | Les anciens tokens conservent temporairement leur comportement `legacy` jusqu’à expiration |
| 2026-09-10 | Passe globale | 199/199, dont 58/58 scénarios courrier ciblés | Web, webmail, mobile et dashboard valides | 14/14 appliquées sur la base Docker locale | Non exécuté, tests end-to-end encore absents | Worktree propre avant correction ; dette lint Dashboard identifiée puis corrigée |
| 2026-09-15 | Lot 4 — transfert | 201/201, dont 14/14 tests réponse/isolation ciblés | Backend typecheck et build valides | Sans migration | Transferts inter-fil et inter-tenant couverts par intégration | Aucun token, message sortant, appel fournisseur ou événement d’activité avant rejet |

## Journal des incidents et régressions

| Date | Lot | Symptôme | Cause | Correction | Test ajouté |
|---|---:|---|---|---|---|
| 2026-09-10 | 7 | Trois pages de détail Dashboard appelaient un hook de route après un retour conditionnel | Le squelette de chargement précédait le hook TanStack Router | Hooks déplacés avant le retour conditionnel | Lint React Hooks |

## Notes de livraison

Pour chaque lot terminé, renseigner :

- la migration appliquée, le cas échéant ;
- les variables d’environnement ajoutées ou modifiées ;
- la stratégie de retour arrière ;
- les métriques ou logs à surveiller ;
- les étapes manuelles de déploiement ;
- les résultats complets de validation ;
- les limitations connues restantes.
