# Suivi des patches de fiabilisation

Document de pilotage associé à [patch-plan-fiabilisation.md](./patch-plan-fiabilisation.md).

## État global

| Champ | Valeur |
|---|---|
| Programme | Fiabilisation de Re-Mail |
| Statut | En cours — lot 0 terminé |
| Dernière mise à jour | 2026-09-07 |
| Branche de référence | `main` |
| Baseline fonctionnelle | 28 fichiers de tests, 167 tests réussis |
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
| 1 | Réception durable et idempotente | Critique | À faire | 0 | Aucun événement perdu ou traité deux fois |
| 2 | Corrélation des conversations | Critique | À faire | 0, 1 | Aucun regroupement fondé seulement sur l’expéditeur |
| 3 | Classement comptes et dossiers | Haute | À faire | 2 | Fils visibles dans la bonne boîte et le bon dossier |
| 4 | Intégrité tenant et validation | Critique | À faire | 0 | Aucune relation cross-tenant acceptée |
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

Statut : **À faire**

- [ ] Définir le schéma `InboundEvent`.
- [ ] Créer la migration et régénérer Prisma Client.
- [ ] Extraire le traitement entrant dans un service.
- [ ] Persister avant l’accusé de réception HTTP.
- [ ] Ajouter la revendication atomique d’un événement.
- [ ] Ajouter les statuts et compteurs de tentatives.
- [ ] Ajouter la reprise des événements échoués.
- [ ] Dédupliquer les identifiants Resend.
- [ ] Dédupliquer les identifiants IMAP.
- [ ] Ajouter un verrou local au poller.
- [ ] Définir la stratégie multi-instance.
- [ ] Nettoyer les logs pour exclure secrets et payloads sensibles.

Validation :

- [ ] Test de webhook dupliqué.
- [ ] Test de concurrence.
- [ ] Test de panne avant accusé de réception.
- [ ] Test de reprise après panne.
- [ ] Test de redémarrage.
- [ ] Test de chevauchement du poller.

## Lot 2 — Corrélation des conversations

Statut : **À faire**

- [ ] Définir les nouvelles métadonnées email.
- [ ] Créer la migration correspondante.
- [ ] Parser `Message-ID`, `In-Reply-To` et `References` côté IMAP.
- [ ] Récupérer ou conserver les mêmes métadonnées côté Resend.
- [ ] Implémenter la règle de corrélation ordonnée.
- [ ] Retirer le rattachement par expéditeur + canal seul.
- [ ] Inclure la boîte source dans toute corrélation personnelle.
- [ ] Ajouter le type d’usage aux tokens de réponse.
- [ ] Empêcher l’écho d’une réponse client.
- [ ] Préserver la lecture des fils historiques.

Validation :

- [ ] Même expéditeur, deux sujets indépendants.
- [ ] Même expéditeur, deux boîtes différentes.
- [ ] Réponse `In-Reply-To`.
- [ ] Réponse `References`.
- [ ] Message sans métadonnées.
- [ ] Transfert collaborateur vers client.
- [ ] Réponse client vers Re-Mail.

## Lot 3 — Comptes et dossiers

Statut : **À faire**

- [ ] Enregistrer `sourceId` lors d’un envoi SMTP.
- [ ] Enregistrer `sourceType` lors d’un envoi SMTP.
- [ ] Réserver `sourceId = null` à Resend.
- [ ] Valider la sémantique produit de Réception/Envoyés.
- [ ] Implémenter le retour visible d’une réponse sur un fil sortant.
- [ ] Aligner les compteurs non lus.
- [ ] Aligner les filtres backend.
- [ ] Invalider les caches webmail concernés.
- [ ] Invalider les caches mobiles concernés.

Validation :

- [ ] Envoi Gmail classé dans Gmail.
- [ ] Envoi IMAP classé dans la bonne boîte.
- [ ] Envoi Resend classé dans Resend.
- [ ] Réponse entrante visible et non lue.
- [ ] Filtres multi-boîtes cohérents.
- [ ] Comportement identique sur web et mobile.

## Lot 4 — Intégrité tenant et validation

Statut : **À faire**

- [ ] Créer les schémas de validation partagés.
- [ ] Vérifier le tenant de l’utilisateur assigné à un fil.
- [ ] Vérifier le tenant de l’utilisateur assigné à une règle.
- [ ] Vérifier le tenant du bénéficiaire d’un `SenderGrant`.
- [ ] Vérifier le fil du message source d’un transfert.
- [ ] Borner la pagination.
- [ ] Valider le destinataire principal.
- [ ] Valider les longueurs de contenu.
- [ ] Imposer la politique de mot de passe côté serveur.
- [ ] Vérifier le domaine auprès de Resend.
- [ ] Valider les alias contre le domaine.
- [ ] Valider le format du secret webhook.
- [ ] Échapper les valeurs des notifications HTML.
- [ ] Uniformiser les réponses `400`, `404` et `500`.

Validation :

- [ ] Tests cross-tenant négatifs.
- [ ] Tests de payloads malformés.
- [ ] Tests de limites de taille et pagination.
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
- [ ] Contrôle TypeScript des quatre applications vert.
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
| Dashboard build | `npm run build` dans `Dashboard/` | Succès |
| Migrations | `prisma migrate status` | Schéma à jour |
| Parcours ciblé | Test manuel ou end-to-end | Critères du lot validés |

Sous Windows avec une politique PowerShell restrictive, utiliser `npm.cmd` et `npx.cmd`.

## Registre des risques

| ID | Risque | Impact | Probabilité | Réduction prévue | État |
|---|---|---|---|---|---|
| R-01 | Perte d’un webhook après réponse `200` | Critique | Moyenne | Lot 1, persistance avant ACK | Ouvert |
| R-02 | Double traitement d’un email | Haute | Moyenne | Lots 1 et 2, idempotence | Ouvert |
| R-03 | Fusion de conversations indépendantes | Haute | Haute | Lot 2, en-têtes email | Ouvert |
| R-04 | Mauvaise boîte ou mauvais dossier | Haute | Haute | Lot 3 | Ouvert |
| R-05 | Relation cross-tenant forgée | Critique | Faible à moyenne | Lot 4 | Ouvert |
| R-06 | Organisation sans propriétaire | Haute | Moyenne | Lot 5 | Ouvert |
| R-07 | Configuration déclarée terminée mais inactive | Haute | Haute | Lot 6, tests réels | Ouvert |
| R-08 | Régression non détectée dans les interfaces | Moyenne | Haute | Lot 7, end-to-end | Ouvert |
| R-09 | Migration impossible sur certains environnements | Haute | Moyenne | Lot 0 | Ouvert |

## Décisions à prendre

| ID | Décision | Options | Choix | Date |
|---|---|---|---|---|
| D-01 | Technologie de file durable | Table PostgreSQL / service de queue | À décider | — |
| D-02 | Verrou multi-instance du poller | Verrou PostgreSQL / worker unique / queue | À décider | — |
| D-03 | Sémantique Réception/Envoyés | Fils dans plusieurs vues / emplacement principal | À décider | — |
| D-04 | Durée de conservation des événements entrants | 30 / 90 / 180 jours | À décider | — |
| D-05 | Politique de mot de passe | Minimum simple / règles renforcées | À décider | — |
| D-06 | Stockage et révocation des sessions | Version utilisateur / table de sessions | À décider | — |

## Journal d’avancement

Ajouter une entrée à chaque session de travail significative.

| Date | Lot | Travail réalisé | Validation | Prochaine action | Auteur |
|---|---:|---|---|---|---|
| 2026-09-07 | — | Création du plan et du document de suivi | Documents relus | Démarrer le lot 0 | Codex |
| 2026-09-07 | 0 | Rejeu des 10 migrations sur une base vide, comparaison des schémas, baseline non destructive de `resend_mail_test` et documentation | Schémas identiques, migration à jour, 167/167 tests sur les deux bases | Démarrer le lot 1 | Codex |

## Journal des validations

| Date | Révision | Tests backend | Builds clients | Migration | Parcours manuel | Notes |
|---|---|---:|---|---|---|---|
| 2026-09-05 | Avant patches | 167/167 | Backend, web, webmail, mobile et dashboard valides | Historique absent sur la base Docker existante | Smoke HTTP valide | Baseline d’audit |
| 2026-09-07 | Lot 0 | 167/167 | Inchangés | 10/10 migrations rejouées et baseline locale restaurée | Non requis | Aucun écart entre le schéma historique et le schéma migré |

## Journal des incidents et régressions

| Date | Lot | Symptôme | Cause | Correction | Test ajouté |
|---|---:|---|---|---|---|
| — | — | — | — | — | — |

## Notes de livraison

Pour chaque lot terminé, renseigner :

- la migration appliquée, le cas échéant ;
- les variables d’environnement ajoutées ou modifiées ;
- la stratégie de retour arrière ;
- les métriques ou logs à surveiller ;
- les étapes manuelles de déploiement ;
- les résultats complets de validation ;
- les limitations connues restantes.
