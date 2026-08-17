# Re-Mail — Admin (back-office plateforme)

Dashboard d'administration **cross-tenant** de la plateforme Re-Mail (à distinguer
de `web/`, qui est le dashboard *par organisation*). Il n'existait jusqu'ici
aucun outil pour opérer la plateforme au-delà d'une organisation — c'est le rôle
de cette app une fois branchée.

**État actuel : branchement progressif.** L'authentification plateforme et les pages
Organisations / Utilisateurs utilisent les API réelles en lecture seule. Les autres
pages bancaires restent des placeholders à remplacer progressivement.

Créer ou réinitialiser le premier administrateur sans mettre son mot de passe dans Git :

```bash
PLATFORM_ADMIN_EMAIL=admin@example.com \
PLATFORM_ADMIN_PASSWORD='mot-de-passe-long' \
PLATFORM_ADMIN_NAME='Admin Re-Mail' \
npm run platform-admin:create
```

## Stack

- **TanStack Start** (SSR) — routage **file-based** dans `src/routes/`, comme documenté dans `src/routes/README.md`. Chaque route est rendue côté serveur : un accès direct ou une actualisation sur n'importe quelle page ne peut jamais tomber sur un 404 statique.
- **shadcn/ui** (`src/components/ui/`) + **Tailwind v4** (`src/styles.css`).
- **lucide-react** pour les icônes, **Recharts** pour les graphes.
- Données mockées dans `src/lib/mock/` — pas de backend branché à ce stade.

## Lancer en local

```bash
cd Dashboard
npm install
npm run dev        # http://localhost:8080
```

## Build & exécution en production

```bash
npm run build       # sortie Node autonome dans .output/ (preset nitro "node-server")
npm run start        # node .output/server/index.mjs
```

Déployable comme un process Node classique, à côté du backend Express (Render) —
pas de compte Cloudflare/Vercel dédié requis.

## Pages / Routes (contenu actuel, placeholder)

```
/                          → Overview (KPIs + graphes)
/transactions              → Table transactions filtrable
/transactions/$id          → Détail transaction + timeline
/accounts                  → Comptes clients
/accounts/$id              → Détail compte (solde, historique, cartes)
/customers                 → Clients (KYC status, segmentation)
/customers/$id             → Fiche client 360°
/transfers                 → Virements internes / SWIFT / instant
/cards                     → Émission & gestion cartes
/compliance                → File KYC / AML / sanctions
/risk                      → Dashboard risque & fraude
/audit                     → Journal d'audit (qui, quoi, quand)
/reports                   → Rapports financiers exportables
/treasury                  → Trésorerie & liquidité
/support                   → Tickets & demandes clients
/users                     → Utilisateurs back-office (admin)
/roles                     → Rôles & permissions (admin)
/settings                  → Paramètres généraux
/notifications             → Centre de notifications
/login                     → Écran de connexion (UI seule, sans auth réelle)
```

## Conventions de routage

Voir `src/routes/README.md` : ne pas créer `src/pages/` ni de conventions
Next.js/Remix — uniquement le file-based routing TanStack (`__root.tsx` = shell,
`_app.tsx` = layout protégé, `_app/*.tsx` = pages).
