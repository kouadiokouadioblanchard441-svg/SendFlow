# Analyse pédagogique : protection contre les injections SQL dans SendFlow

## Résumé

L’API SendFlow utilise Drizzle avec PostgreSQL. Dans les routes examinées, les valeurs issues des requêtes HTTP sont transmises au query builder Drizzle ou à des paramètres PostgreSQL `$1`, `$2`, etc. Elles ne sont donc pas concaténées dans la structure SQL.

L’audit n’a pas identifié d’injection SQL dans les zones décrites ici. Le script de backfill PII utilise bien des requêtes brutes, mais ses identifiants dynamiques sont contrôlés par listes autorisées et ses valeurs sont liées comme paramètres.

> **Précision importante :** dans Drizzle, `sql\`... ${value}\`` n’est pas équivalent à une concaténation JavaScript. Pour une valeur ordinaire, Drizzle génère un paramètre lié. Un fragment SQL brut créé avec `sql.raw()` ou une chaîne construite par concaténation présente un risque différent.

## A. Architecture de protection

```text
Entrée HTTP
    │
    ├─ validation de format et de taille
    ├─ authentification et contrôle de propriété côté serveur
    ▼
Route Express
    │
    ├─ query builder Drizzle (valeurs liées)
    └─ SQL brut exceptionnel (paramètres PostgreSQL + identifiants contrôlés)
    ▼
PostgreSQL
```

Le client PostgreSQL commun est créé avec `drizzle(pool)` dans [`lib/db/src/client.ts`](lib/db/src/client.ts). Les routes importent `db`, les opérateurs Drizzle et les tables du schéma partagé. La validation d’entrée et l’authentification restent nécessaires pour les règles métier et les droits d’accès; elles complètent la protection SQLi, elles ne la remplacent pas.

### Exemple 1 — Lire le portefeuille de la session courante

Dans [`account.ts`](artifacts/api-server/src/routes/account.ts#L71-L80) :

```ts
const session = await requireCustomerSession(req, res, true);
if (!session) return;

const [wallet] = await db
  .select()
  .from(walletsTable)
  .where(eq(walletsTable.userId, session.userId))
  .limit(1);
```

`eq()` construit la condition avec Drizzle. `session.userId` est une valeur liée, pas du texte SQL. Le nom de table et la colonne sont des références de schéma dans le code, pas des chaînes fournies par le navigateur. La session est également vérifiée côté serveur.

### Exemple 2 — Rechercher dans l’historique client

Dans [`account.ts`](artifacts/api-server/src/routes/account.ts#L109-L153) :

```ts
const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
const searchPattern = search ? `%${escapedSearch}%` : undefined;

const searchCondition = searchPattern
  ? or(
      ilike(transactionsTable.senderPhone, searchPattern),
      ilike(transactionsTable.recipientPhone, searchPattern),
      ilike(transactionsTable.reference, searchPattern),
    )
  : undefined;
```

`ilike()` reçoit la chaîne comme valeur; Drizzle la lie au lieu de l’insérer dans la syntaxe SQL. L’échappement de `\`, `%` et `_` a un rôle supplémentaire : une recherche contenant ces caractères les traite comme des caractères littéraux plutôt que comme des jokers `LIKE`. La limite de longueur et la vérification du type réduisent aussi les entrées anormales et la charge.

### Exemple 3 — Curseur de pagination

Dans [`account.ts`](artifacts/api-server/src/routes/account.ts#L114-L120) et [`customer-transaction-cursor.ts`](artifacts/api-server/src/lib/customer-transaction-cursor.ts#L1-L29) :

```ts
const cursorCreatedAt = cursor
  ? sql<Date>`(
      select ${transactionsTable.createdAt}
      from ${transactionsTable}
      where ${transactionsTable.id} = ${cursor}
        and ${transactionsTable.userId} = ${session.userId}
      limit 1
    )`
  : undefined;
```

Le tag `sql` de Drizzle compile les références de schéma comme identifiants et les chaînes `cursor` et `session.userId` comme paramètres. En amont, le curseur doit correspondre au format UUID attendu; la requête vérifie également que la ligne appartient à l’utilisateur authentifié. La validation du curseur ne sert pas de substitut aux paramètres liés : les deux contrôles ont des objectifs différents.

### Exemple 4 — Verrou de réservation OTP

Dans [`phone-otp.ts`](artifacts/api-server/src/routes/phone-otp.ts#L285-L297) :

```ts
for (const lockKey of lockKeys) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );
}
```

`lockKey` est interpolé dans un template Drizzle, donc transmis comme donnée liée à PostgreSQL. Son contenu ne peut pas ajouter une clause ou fermer la fonction SQL.

### Exemple 5 — Backfill des données personnelles

Dans [`backfill-sensitive-data.mjs`](artifacts/api-server/scripts/backfill-sensitive-data.mjs#L34-L56) et [`backfill-sensitive-data.mjs`](artifacts/api-server/scripts/backfill-sensitive-data.mjs#L133-L170) :

```js
const backfillTableColumns = {
  sf_users: new Set(["phone", "display_name", "birth_date::text"]),
  sf_contacts: new Set(["label", "phone"]),
  sf_transactions: new Set(["sender_phone", "recipient_phone", "provider_reference"]),
};

const allowedColumns = backfillTableColumns[table];
if (
  !allowedColumns
  || idColumn !== "id"
  || fields.some((field) => !allowedColumns.has(field.column))
) {
  throw new Error("Backfill query contains an unsupported table or column");
}

const { rows } = await pool.query(
  `SELECT ${idColumn}, ${fieldList} FROM public.${table}
   WHERE ${idColumn} > $1 ORDER BY ${idColumn} LIMIT $2`,
  [afterId, pageSize],
);
```

Les noms de tables et de colonnes ne peuvent pas être liés comme des valeurs SQL; ils sont donc contrôlés par listes autorisées avant l’assemblage de cette requête. Les valeurs de recherche (`afterId`, `pageSize`) restent des paramètres `$1`, `$2`. Les mises à jour utilisent également des placeholders pour les données, et les noms de colonnes proviennent des champs préalablement autorisés.

## B. Analyse des cas à risque

### 1. Backfill PII : les identifiants ne sont pas des paramètres

Un placeholder PostgreSQL ne peut représenter qu’une **valeur**, pas un nom de table ou de colonne. Le backfill doit donc construire ces identifiants autrement. SendFlow vérifie table, colonnes, colonnes de hachage et `idColumn` contre des listes définies dans le script. Si un identifiant inattendu arrive, le script lève une erreur avant la requête.

Les valeurs elles-mêmes restent séparées du texte SQL. Il ne faut pas supprimer les listes autorisées sous prétexte que « les appels viennent du script » : ce contrôle est la frontière de sécurité pour les parties dynamiques de l’identifiant.

### 2. Recherches `LIKE` / `ILIKE` : liaison et échappement ont des rôles distincts

- **Protection SQLi :** Drizzle lie la valeur passée à `ilike()`; les caractères du terme recherché ne deviennent pas de la syntaxe SQL.
- **Sémantique de recherche :** dans l’historique client, `%`, `_` et `\` sont échappés afin qu’ils ne deviennent pas des jokers.
- **Recherche administrateur :** [`admin.ts`](artifacts/api-server/src/routes/admin.ts#L225-L255) construit des motifs `%${search}%` passés à `ilike()`. Ils restent liés et ne créent pas une injection SQL. En revanche, `%` et `_` fournis dans la recherche gardent leur signification de joker. Si le produit exige une recherche littérale, il faudra ajouter un échappement explicite et le tester; ce n’est pas une correction SQLi.

### 3. Curseurs paginés : format, propriété et paramètres

Le curseur est limité à un UUID, les curseurs inconnus ou appartenant à un autre utilisateur sont rejetés, et la requête de pagination lie les paramètres. Le numéro de page est aussi borné et converti en entier sûr avant d’être utilisé comme limite. Le format strict aide à rejeter les valeurs invalides, mais la propriété et la liaison SQL demeurent indispensables.

### Mauvais exemple — une vraie concaténation vulnérable

Le code suivant est **hypothétique et ne doit pas être copié** :

```js
// Vulnérable : la donnée modifie le texte SQL avant son analyse.
await pool.query(
  "SELECT * FROM sf_users WHERE id = '" + rawInput + "'",
);
```

Pour une valeur, l’API PostgreSQL devrait plutôt recevoir le SQL et la donnée séparément :

```js
// Forme paramétrée : rawInput est une valeur, pas de la syntaxe SQL.
await pool.query(
  "SELECT * FROM sf_users WHERE id = $1",
  [rawInput],
);
```

Et dans une route SendFlow utilisant Drizzle, préférer le query builder, par exemple `eq(usersTable.id, userId)`.

> **À ne pas enseigner comme vulnérable :** `sql\`SELECT ... WHERE id = ${rawInput}\`` avec le tag `sql` de Drizzle lie normalement `rawInput` comme valeur. Le risque apparaît si l’on injecte un fragment brut (`sql.raw`) ou si l’on concatène une entrée dans une chaîne SQL.

## C. Comparaison vulnérable / sécurisé

### Portefeuille

❌ **Hypothétique vulnérable :**

```ts
await pool.query(
  `SELECT * FROM sf_wallets WHERE user_id = '${req.query.userId}'`,
);
```

✅ **SendFlow :**

```ts
.where(eq(walletsTable.userId, session.userId))
```

🧠 La valeur de la session est liée par Drizzle. SendFlow ne prend pas `userId` directement depuis la query string pour décider quel portefeuille retourner.

### Historique `ILIKE`

❌ **Hypothétique vulnérable :**

```ts
await pool.query(
  `SELECT * FROM sf_transactions WHERE reference ILIKE '%${req.query.search}%'`,
);
```

✅ **SendFlow :**

```ts
const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
const searchPattern = search ? `%${escapedSearch}%` : undefined;
ilike(transactionsTable.reference, searchPattern);
```

🧠 La condition Drizzle lie le motif. L’échappement protège le sens littéral de la recherche; ce n’est pas lui qui assure seul la protection SQLi.

### Curseur

❌ **Hypothétique vulnérable :**

```ts
const query = `... WHERE id = '${req.query.cursor}'`;
```

✅ **SendFlow :**

```ts
where ${transactionsTable.id} = ${cursor}
  and ${transactionsTable.userId} = ${session.userId}
```

🧠 Dans le template Drizzle, les valeurs sont des paramètres; le curseur est validé et la requête est limitée à la session. Une concaténation de chaîne n’offre aucune de ces garanties.

### Verrou OTP

❌ **Hypothétique vulnérable :**

```ts
await tx.execute(sql.raw(
  `select pg_advisory_xact_lock(hashtextextended('${lockKey}', 0))`,
));
```

✅ **SendFlow :**

```ts
await tx.execute(
  sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
);
```

🧠 Le premier exemple transforme la chaîne en syntaxe SQL brute. Le second garde le SQL fixe et lie `lockKey` comme donnée.

### Backfill PII

❌ **Hypothétique vulnérable :**

```js
const sql = `SELECT ${req.query.column} FROM ${req.query.table}`;
```

✅ **SendFlow :**

```js
if (!allowedColumns || idColumn !== "id" || fields.some(
  (field) => !allowedColumns.has(field.column),
)) {
  throw new Error("Backfill query contains an unsupported table or column");
}
```

🧠 Les noms d’identifiants sont vérifiés avant d’être mis dans le SQL; les valeurs sont transmises séparément avec des placeholders. Une validation de format seule ne suffirait pas pour autoriser un identifiant SQL.

## D. Le test de sécurité ajouté

Le test [`sql-injection-boundary.test.mjs`](artifacts/api-server/src/lib/sql-injection-boundary.test.mjs) est inclus dans la commande `test:security` du paquet API. Il parcourt les sources TypeScript d’exécution sous `src/routes` et `src/lib`, puis échoue si elles contiennent :

- un import direct de `pg` ou `node-postgres`;
- un appel `pool.query()` ou `client.query()`;
- `sql.raw()`;
- un appel `db.execute()` ou `tx.execute()` dont l’argument immédiat n’est pas un template `sql\`...\``.

Voici le code du test réel; sa source de vérité reste [`sql-injection-boundary.test.mjs`](artifacts/api-server/src/lib/sql-injection-boundary.test.mjs) :

```js
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function collectRuntimeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectRuntimeFiles(fullPath);
      if (
        entry.isFile()
        && entry.name.endsWith(".ts")
        && !entry.name.endsWith(".test.ts")
        && !entry.name.endsWith(".d.ts")
      ) {
        return [fullPath];
      }
      return [];
    }),
  );
  return nestedFiles.flat();
}

test("API runtime keeps SQL behind parameterized Drizzle statements", async () => {
  const runtimeFiles = await Promise.all(
    ["routes", "lib"].map((directory) =>
      collectRuntimeFiles(path.join(sourceDirectory, directory)),
    ),
  ).then((groups) => groups.flat());

  const violations = [];

  for (const filePath of runtimeFiles) {
    const source = await readFile(filePath, "utf8");
    const executableSource = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    const relativePath = path.relative(sourceDirectory, filePath);

    if (/from\s+["'](?:pg|node-postgres)["']/.test(executableSource)) {
      violations.push(`${relativePath}: direct PostgreSQL driver import`);
    }
    if (/\b(?:pool|client)\.query\s*\(/.test(executableSource)) {
      violations.push(`${relativePath}: direct PostgreSQL query call`);
    }
    if (/\bsql\.raw\s*\(/.test(executableSource)) {
      violations.push(`${relativePath}: raw Drizzle SQL fragment`);
    }

    for (const match of executableSource.matchAll(/\b(?:db|tx)\.execute\s*\(/g)) {
      const statementStart = executableSource.slice(match.index + match[0].length);
      if (!/^\s*sql\s*`/.test(statementStart)) {
        violations.push(
          `${relativePath}: execute() must receive a parameterized sql template`,
        );
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      "SQL injection boundary violations found:",
      ...violations.map((violation) => `- ${violation}`),
    ].join("\n"),
  );
});
```

Ce contrôle empêche le retour accidentel vers certains points d’entrée SQL bruts repérés par le test. **Ce n’est pas un analyseur syntaxique TypeScript** : il repose sur des motifs textuels, ne contrôle pas les scripts `.mjs` tels que le backfill, et n’envoie pas de payload à PostgreSQL. Il complète la revue et les tests ciblés, sans les remplacer.

## E. Bonnes pratiques SendFlow

1. **Par défaut, utiliser Drizzle.** Préférer `eq`, `and`, `or`, `ilike`, `inArray`, etc., avec les tables du schéma partagé.
2. **Garder les valeurs comme valeurs.** Dans le query builder et les templates `sql` Drizzle, passer les entrées comme expressions liées; ne pas les concaténer dans du SQL.
3. **Ne jamais passer une entrée libre à `sql.raw()`.** Réserver tout fragment brut à une syntaxe constante et revue.
4. **Pour un nom de table ou de colonne dynamique, exiger une liste autorisée.** Les placeholders ne remplacent pas les identifiants SQL. Construire ce type de requête seulement à partir de choix codés et testés.
5. **Valider les entrées pour leur contrat métier.** Limiter longueur, forme, valeurs numériques et pagination. Cela protège les règles de SendFlow et les ressources; la liaison SQL reste nécessaire même après validation.
6. **Séparer contrôle d’accès et SQLi.** Vérifier session, rôle et propriété des lignes côté serveur. Une requête paramétrée peut être sans SQLi tout en lisant les mauvaises lignes si son filtre d’autorisation manque.
7. **Traiter les jokers de recherche explicitement.** Décider si `%` et `_` sont des jokers voulus ou des caractères littéraux, puis appliquer et tester la règle.
8. **Tester sans base partagée.** Les tests nécessitant PostgreSQL doivent utiliser une base isolée; ne pas envoyer de payloads d’essai à Neon partagé ou à la production.
9. **Ajouter un garde-fou quand une exception est nécessaire.** Documenter pourquoi le SQL brut est nécessaire, quelles parties sont des identifiants, comment elles sont autorisées, et quelles valeurs sont liées.
