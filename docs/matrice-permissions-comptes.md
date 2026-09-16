# Matrice de permissions des comptes

Cette matrice fixe les règles de gouvernance des comptes d’une organisation Re-Mail. Elle complète le [plan de fiabilisation](./patch-plan-fiabilisation.md) et sert de contrat aux routes `/api/users`, `/api/user-invites` et à l’import de configuration.

## Principes

- Le rôle `OWNER` ne peut jamais être créé, invité ou attribué par une mise à jour générique.
- La propriété passe uniquement par `POST /api/users/:id/transfer-ownership`.
- Un transfert promeut la cible en `OWNER` et rétrograde l’ancien propriétaire en `ADMIN` dans une même transaction.
- Un propriétaire ne peut pas être supprimé ou rétrogradé par les routes génériques.
- Le rôle et l’existence du compte sont relus en base à chaque requête authentifiée : un JWT ancien ne conserve pas des droits retirés.
- Les ressources d’une autre organisation restent invisibles (`404`) avant toute vérification de rôle métier.

## Gouvernance des utilisateurs

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| Consulter l’annuaire de l’organisation | Oui | Oui | Oui |
| Créer ou inviter un MEMBER | Oui | Oui | Non |
| Créer ou inviter un ADMIN | Oui | Non | Non |
| Créer ou inviter un OWNER | Non | Non | Non |
| Modifier un MEMBER | Oui | Oui | Non |
| Modifier ou supprimer un ADMIN | Oui | Non | Non |
| Modifier le profil non-rôle d’un OWNER | Oui | Non | Non |
| Rétrograder ou supprimer un OWNER par la route générique | Non | Non | Non |
| Transférer la propriété à un utilisateur existant | Oui | Non | Non |
| Gérer les autorisations d’envoi d’un MEMBER | Oui | Oui | Non |

Un import CSV applique les mêmes plafonds : un `ADMIN` ne peut importer que des invitations `MEMBER`, tandis qu’un `OWNER` peut importer des `MEMBER` et `ADMIN`.

## Permissions opérationnelles conservées

Les fonctions de configuration d’organisation, des routes mail, des règles de routage et des modèles de réponse restent accessibles aux `OWNER` et `ADMIN`. Les `MEMBER` conservent l’accès à leur messagerie, à leurs brouillons, à leurs boîtes personnelles et aux fils qui leur sont accessibles.

## Codes de réponse

- `400` : opération incohérente sur son propre compte ou cible de transfert invalide ;
- `403` : rôle insuffisant ;
- `404` : cible absente ou appartenant à une autre organisation ;
- `409` : propriétaire protégé, cible déjà propriétaire ou transfert concurrent déjà réalisé.

