# SendFlow

SendFlow est une application de transfert et de gestion de flux destinée aux utilisateurs de la région ouest-africaine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
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
- Neon est la base de référence partagée par Plesk en production et par les aperçus/tests Replit. Les lignes de la base Replit précédente ne sont pas importées.
- Les aperçus et tests Replit voient les données réelles de Neon. Ne pas y lancer de scénarios qui créent des comptes réels, envoient des SMS payants ou modifient des transferts ou soldes. Vérifier le schéma Neon avant chaque évolution et utiliser des migrations additives ciblées, pas un push Drizzle global.
- Le nombre de proxys de confiance doit correspondre à l’infrastructure de déploiement : `TRUST_PROXY_HOPS` le règle et vaut 1 par défaut. En production, renseigner `CORS_ALLOWED_ORIGINS` avec l’origine HTTPS exacte du site; seules les origines configurées sont acceptées et le domaine d’aperçu Replit est exclu.
- La création de sessions Didit est plafonnée à trois tentatives par compte sur 24 heures glissantes; les soldes et montants ont aussi des contraintes SQL. Ces protections nécessitent leurs migrations additives avant déploiement. Les contraintes de portefeuille sont `NOT VALID` pour ne pas scanner l’historique; contrôler les anciennes données séparément. Ne jamais lancer ces migrations sur Neon sans autorisation.

## Product

SendFlow doit devenir une application accessible après authentification. Les écrans publics actuels servent uniquement de transition pendant le développement ; les prochaines fonctionnalités doivent prioritairement renforcer le produit connecté et ses parcours d’accès.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
