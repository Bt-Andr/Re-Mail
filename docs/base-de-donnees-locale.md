# Base de données locale et migrations

## Périmètre

Le backend utilise PostgreSQL via Prisma. La suite automatisée cible par défaut la
base jetable suivante, définie dans `test/setup.ts` :

```text
postgresql://postgres:test@localhost:5433/resend_mail_test
```

Cette base doit rester distincte de toute base de développement contenant des
données utiles et de toute base distante. Le fichier `.env` peut cibler une autre
base ; il ne faut donc pas lancer une commande Prisma destructive sans vérifier
explicitement la valeur de `DATABASE_URL` utilisée par la commande.

## Démarrage

Le conteneur local attendu est `resend-mail-test-db` et publie PostgreSQL sur le
port `5433`.

```powershell
docker start resend-mail-test-db
Test-NetConnection -ComputerName localhost -Port 5433
```

Le test est prêt lorsque `TcpTestSucceeded` vaut `True`.

## Vérifier l’état des migrations

PowerShell :

```powershell
$env:DATABASE_URL='postgresql://postgres:test@localhost:5433/resend_mail_test'
npx.cmd prisma migrate status
```

Bash :

```bash
DATABASE_URL='postgresql://postgres:test@localhost:5433/resend_mail_test' \
  npx prisma migrate status
```

Le résultat attendu est :

```text
Database schema is up to date!
```

## Appliquer les migrations non destructives

Sur une base vide ou déjà gérée par Prisma :

```powershell
$env:DATABASE_URL='postgresql://postgres:test@localhost:5433/resend_mail_test'
npx.cmd prisma migrate deploy
```

`migrate deploy` ne doit pas être remplacé automatiquement par `migrate reset` ou
`db push`. Une réinitialisation supprime les données et exige une décision explicite.

## Valider une chaîne complète depuis une base neuve

Pour vérifier que toutes les migrations permettent réellement de reconstruire le
projet, utiliser une base temporaire séparée :

```powershell
docker exec resend-mail-test-db createdb -U postgres resend_mail_migration_check
$env:DATABASE_URL='postgresql://postgres:test@localhost:5433/resend_mail_migration_check'
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
npm.cmd test
```

Après validation, cette base temporaire peut être supprimée si elle ne contient
aucune donnée à conserver :

```powershell
docker exec resend-mail-test-db dropdb -U postgres resend_mail_migration_check
```

## Comparer deux schémas avant une baseline

Une ancienne base peut contenir toutes les tables sans table
`_prisma_migrations`, par exemple après un ancien `prisma db push`. Avant toute
baseline, comparer son schéma à celui reconstruit par les migrations :

```powershell
npx.cmd prisma migrate diff `
  --from-url "postgresql://postgres:test@localhost:5433/resend_mail_test" `
  --to-url "postgresql://postgres:test@localhost:5433/resend_mail_migration_check" `
  --script
```

Le seul résultat acceptable avant de marquer les migrations comme appliquées est :

```sql
-- This is an empty migration.
```

`prisma migrate resolve --applied` ne modifie pas les tables applicatives : il
inscrit une migration dans l’historique. Cette commande ne doit être utilisée
qu’une fois, après une comparaison vide et après vérification de la base ciblée.

## Exécuter les tests

La suite utilise automatiquement la base locale ci-dessus lorsqu’aucune autre
variable `DATABASE_URL` n’est déjà injectée dans le processus :

```powershell
npm.cmd test
```

Pour rendre la cible explicite :

```powershell
$env:DATABASE_URL='postgresql://postgres:test@localhost:5433/resend_mail_test'
npm.cmd test
```

Les fichiers de tests s’exécutent séquentiellement et nettoient les données
applicatives nécessaires. Ils ne remplacent toutefois pas la base ni son historique
de migrations.

## Baseline vérifiée le 7 septembre 2026

- Les 10 migrations versionnées ont été rejouées sur une base vide.
- Le schéma reconstruit était identique au schéma historique de
  `resend_mail_test`.
- Les 10 migrations ont été enregistrées comme appliquées sur la base locale sans
  modifier ses tables applicatives.
- `prisma migrate status` a confirmé que la base était à jour.
- Les 28 fichiers de tests et les 167 tests ont réussi sur la base migrée, puis sur
  la base habituelle baselinée.
