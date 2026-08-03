# Resend Mail — app mobile (Expo / React Native)

Phase 4 du projet [resend-mail-module](../CLAUDE.md) : consomme la même API que `web/`, aucune route backend spécifique au mobile (hormis `POST /api/devices` déjà prévu pour l'enregistrement des push tokens Expo).

## Lancer en local

```bash
cd resend-mail-module/mobile
npm install
npx expo start
```

Le backend (`resend-mail-module`, port 3001) doit tourner en parallèle — voir `CLAUDE.md` à la racine.

`.env` doit exister (copier `.env.example`) avec `EXPO_PUBLIC_API_URL` adapté à votre cible :
- Simulateur iOS : `http://localhost:3001/api`
- Émulateur Android : `http://10.0.2.2:3001/api`
- Appareil physique (Expo Go) : `http://<IP LAN>:3001/api`

## Stack

Expo Router (navigation fichier), NativeWind (Tailwind), TanStack Query (cache serveur), `expo-secure-store` (JWT), `expo-notifications` (push). Détails et décisions dans le plan de build à `C:\Users\Admin\.claude\plans\warm-tumbling-pike.md`.

## Notifications push

Nécessite un projet EAS configuré (`eas init`) pour obtenir un `projectId` — sans ça, l'enregistrement du push token échoue silencieusement et le reste de l'app fonctionne normalement (voir `src/hooks/usePushRegistration.ts`).

## Périmètre actuel (Jalons A, B, C)

Connexion, activation d'invitation (fichier + code), boîte de réception (Inbox/Envoyés/Corbeille, filtres, recherche), détail de fil, réponse/transfert avec pièces jointes, changement de statut, assignation, notifications push, thème clair/sombre, déconnexion, écrans admin (Mail Routes, Invites, Users, Org Settings), brouillons (autosave + reprise), modèles de réponse (insertion composeur + gestion OWNER/ADMIN), journal d'activité par fil.

Pas encore construit : persistance offline du cache de requêtes (pas de bannière hors-ligne dédiée — les échecs réseau affichent un état d'erreur avec bouton « Réessayer »).
