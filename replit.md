# SendFlow

SendFlow est une application de transfert et de gestion de flux destinée aux utilisateurs de la région ouest-africaine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `NEON_DATABASE_URL` for the external Neon database, with `DATABASE_URL` retained as a fallback

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Les parcours d’inscription et de connexion sont conçus comme la porte d’entrée de l’application, pas comme des pages autonomes de vitrine.
- La page vitrine actuelle est transitoire et sera supprimée lorsque le produit applicatif sera prêt.

## Product

SendFlow doit devenir une application accessible après authentification. Les écrans publics actuels servent uniquement de transition pendant le développement ; les prochaines fonctionnalités doivent prioritairement renforcer le produit connecté et ses parcours d’accès.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
