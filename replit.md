# SendFlow

SendFlow est une application de transfert et de gestion de flux destinée aux utilisateurs de la région ouest-africaine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run check:secrets` — scan versioned and non-ignored text files for credential literals and client/server boundary violations; never prints matched values
- `pnpm run test:secret-boundaries` — isolated checks for client environment allowlisting, secret detection, and safe application/HTTP logging
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Les parcours d’inscription et de connexion sont la porte d’entrée publique de l’application.
- Les anciennes surfaces de présentation ont été retirées du produit ; les prochaines fonctionnalités doivent être ajoutées derrière l’accès applicatif.
- La base PostgreSQL partagée est configurée côté serveur. Les tables ont été créées dans la nouvelle base, mais les données précédentes n’ont pas été transférées.
- Les aperçus Replit utilisent une protection API qui limite les accès aux lectures publiques connues; les écritures, paiements et routes privées restent bloqués. Ne lancez aucun scénario qui crée des comptes réels, envoie des SMS payants ou modifie des transferts ou soldes. Utilisez des migrations additives ciblées, jamais un push Drizzle global.
- SendFlow est une grande application financière en cours de développement : ne pas prendre de raccourci. Avant de passer à une fonctionnalité dépendante, vérifier les invariants métier, les erreurs, la concurrence, l’idempotence, la persistance et la reprise avec des tests isolés; un build et le parcours nominal ne suffisent pas. Signaler comme non vérifiés les points qui exigent une infrastructure ou des données réelles.
- Le nombre de proxys de confiance doit correspondre à l’infrastructure de déploiement. En développement, `TRUST_PROXY_HOPS` vaut 1 par défaut; en production, `TRUST_PROXY_HOPS` doit être explicitement configuré et l’API refuse de démarrer si cette valeur manque ou est invalide. En production, renseigner aussi `CORS_ALLOWED_ORIGINS` avec les origines HTTPS exactes; l’API refuse une liste absente/invalide et n’utilise pas `REPLIT_DOMAINS` comme liste de confiance.
- La vérification d’identité par fournisseur externe est retirée. Les anciens dossiers restent conservés à titre d’historique mais ne donnent plus accès à un plafond supérieur; le plafond mensuel reste à 150 000 XOF jusqu’à la mise en place d’un nouveau parcours validé. Ne pas supprimer l’historique ni relancer l’ancien service. Les soldes et montants gardent leurs contraintes SQL; toute migration financière doit rester additive et explicitement autorisée.

## Product

SendFlow doit devenir une application accessible après authentification. Les écrans publics actuels servent uniquement de transition pendant le développement ; les prochaines fonctionnalités doivent prioritairement renforcer le produit connecté et ses parcours d’accès.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
