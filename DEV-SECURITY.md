# Guide développeur : sécurité des routes SendFlow

Ce guide s’applique à l’API SendFlow et à ses scripts serveur. Il ne demande aucune modification des pages client ou administrateur.

## Ajouter une route de façon sûre

1. **Définir le contrat d’entrée.** Décrire les paramètres et les valider avec les schémas Zod existants ou un schéma dédié. Refuser les types, longueurs, formats et valeurs hors limites.
2. **Authentifier avant les accès privés.** Utiliser le middleware ou l’aide de session appropriée. Ne jamais considérer l’ID, le rôle ou la propriété envoyés par le navigateur comme une autorité.
3. **Construire les requêtes avec Drizzle.** Importer `db`, les opérateurs Drizzle et les tables du schéma partagé.
4. **Lier les valeurs et vérifier les droits dans la requête.** Une valeur paramétrée protège la syntaxe SQL; un filtre de propriétaire protège les données.
5. **Retourner des erreurs contrôlées.** Ne pas renvoyer les détails SQL, les chaînes de connexion ou les erreurs internes au client.
6. **Ajouter des tests négatifs.** Couvrir les entrées invalides, les identifiants inconnus et les cas d’accès à une ressource étrangère. Pour les tests PostgreSQL, utiliser une base isolée.

### Pattern à privilégier

Exemple inspiré de [`account.ts`](artifacts/api-server/src/routes/account.ts) :

```ts
const parsed = MyRouteQuery.safeParse(req.query);
if (!parsed.success) {
  res.status(400).json({ error: "Invalid filters" });
  return;
}

const [record] = await db
  .select()
  .from(myTable)
  .where(and(
    eq(myTable.id, parsed.data.id),
    eq(myTable.userId, session.userId),
  ))
  .limit(1);
```

Les valeurs transmises à `eq()` sont liées par Drizzle. `session.userId` est l’autorité pour la propriété; ne le remplacer pas par un identifiant client non vérifié.

## Pièges à éviter

### Concaténer une valeur dans le SQL

À ne pas faire :

```ts
const statement = `SELECT * FROM sf_users WHERE phone = '${phone}'`;
```

Utiliser le query builder Drizzle. Si un accès PostgreSQL direct est nécessaire, utiliser des placeholders (`$1`, `$2`) et fournir les valeurs dans le tableau de paramètres.

### Confondre `sql` et `sql.raw`

Le template `sql\`...\`` de Drizzle lie les valeurs interpolées comme paramètres et comprend les références de schéma. `sql.raw()` insère un fragment SQL brut : ne jamais lui transmettre une entrée utilisateur ou une chaîne dérivée de celle-ci.

### Interpoler des identifiants dynamiques

Un paramètre PostgreSQL ne peut pas remplacer un nom de table ou de colonne. Si un identifiant dynamique est réellement indispensable :

- partir d’une liste autorisée définie dans le code;
- vérifier chaque identifiant avant de construire la requête;
- garder les valeurs ordinaires dans des placeholders;
- ajouter des tests qui rejettent tout identifiant non autorisé.

Le backfill PII de [`backfill-sensitive-data.mjs`](artifacts/api-server/scripts/backfill-sensitive-data.mjs) est un exemple de ce contrôle par liste autorisée.

### Oublier les jokers `LIKE`

Le binding protège contre SQLi, mais `%` et `_` conservent leur effet de jokers dans `LIKE`/`ILIKE`. Décider si la recherche doit être littérale ou si les jokers sont une fonctionnalité. Échapper les jokers quand une recherche littérale est attendue, comme dans l’historique client de [`account.ts`](artifacts/api-server/src/routes/account.ts).

### Compter sur la validation seule

Valider un UUID, un téléphone ou un entier réduit les valeurs invalides et protège le contrat métier. Cela ne rend pas sûre une concaténation SQL. Lier les valeurs reste obligatoire.

### Oublier le filtre de propriété

Un SQLi absent ne garantit pas qu’une route ne divulgue pas les données d’un autre utilisateur. Toute lecture ou modification privée doit inclure l’identité provenant de la session serveur ou une vérification d’accès équivalente.

## Si du SQL brut est nécessaire

1. D’abord vérifier si Drizzle permet de représenter la requête.
2. Garder la structure SQL constante et les données dans des paramètres.
3. Autoriser explicitement chaque identifiant dynamique; ne pas permettre à une entrée HTTP de choisir un fragment SQL.
4. Ajouter un commentaire indiquant pourquoi le SQL brut est nécessaire et quelles parties sont autorisées.
5. Ajouter un test ciblé, idéalement contre une base PostgreSQL jetable pour les comportements dépendants du moteur.
6. Ne jamais tester un payload d’attaque contre la base partagée ou la production.
7. Faire évoluer le test `sql-injection-boundary.test.mjs` seulement si l’exception est justifiée et qu’un contrôle équivalent est mis en place; ne pas désactiver le test pour faire passer le build.

## Checklist avant merge

- [ ] Les paramètres de route sont validés (format, taille, plage et valeurs permises).
- [ ] Les routes privées authentifient côté serveur et vérifient le rôle/la propriété.
- [ ] Les requêtes utilisent Drizzle; aucune donnée utilisateur n’est concaténée au SQL.
- [ ] Aucun `sql.raw()` ne reçoit une valeur contrôlée par l’utilisateur.
- [ ] Tout identifiant SQL dynamique vient d’une liste autorisée et est contrôlé avant usage.
- [ ] Les motifs `LIKE`/`ILIKE` ont le comportement attendu pour `%`, `_` et `\`.
- [ ] Les curseurs et limites de pagination sont validés et bornés.
- [ ] Les erreurs SQL internes et les secrets ne sont pas renvoyés ou journalisés dans une réponse publique.
- [ ] Les tests de sécurité et le typecheck API passent.
- [ ] Les tests PostgreSQL utilisent une base isolée, jamais Neon partagé ou la production.
- [ ] Aucune page client ou administrateur n’a été modifiée dans un changement limité au serveur.

## Références SendFlow

- Connexion Drizzle/PostgreSQL : [`lib/db/src/client.ts`](lib/db/src/client.ts)
- Lecture du compte, recherche et curseur : [`account.ts`](artifacts/api-server/src/routes/account.ts)
- Recherche administrateur : [`admin.ts`](artifacts/api-server/src/routes/admin.ts)
- Verrou SQL paramétré pour OTP : [`phone-otp.ts`](artifacts/api-server/src/routes/phone-otp.ts)
- Backfill PII et listes autorisées : [`backfill-sensitive-data.mjs`](artifacts/api-server/scripts/backfill-sensitive-data.mjs)
- Garde-fou statique SQLi : [`sql-injection-boundary.test.mjs`](artifacts/api-server/src/lib/sql-injection-boundary.test.mjs)
