# Initialisation du catalogue des pays africains

Le script `artifacts/api-server/scripts/seed-african-country-catalog.mjs` insère
les 54 pays africains ISO dans `public.sf_countries`. Il est idempotent :
les codes déjà présents sont conservés sans modifier leur nom, leurs bornes de
numérotation ni leurs paramètres de paiement. Les nouveaux pays sont visibles
pour l’inscription (`enabled = true`), mais les trois opérations financières
restent désactivées et aucun opérateur ni routage n’est créé.

Les indicatifs et longueurs générales proviennent des métadonnées
`libphonenumber-js` 1.13.15 (`metadata.max.json`, version de métadonnées 4),
avec les longueurs du Bénin (10), du Cameroun (9), du Mali (8), du Niger (8)
et du Congo-Brazzaville (9) gardées conformes aux sources réglementaires déjà
documentées dans `README.md`. Ces bornes sont des contrôles de format, pas une
validation complète de numéro mobile, une preuve d’allocation, une couverture
OTP ou une autorisation de paiement. Aucun SMS n’est envoyé.

## Cible et exécution

Le secret `SUPABASE_DATABASE_URL` du projet est réservé au runtime partagé
Replit (`SENDFLOW_DATABASE_TARGET=shared-external`). Le middleware Replit bloque
les écritures dans cette cible. Le seed refuse aussi explicitement de s’exécuter
dans Replit. Pour la production, Plesk doit être configuré avec la même base
Supabase sous `DATABASE_URL`, `SENDFLOW_DATABASE_TARGET=production`,
`NODE_ENV=production` et le certificat TLS de confiance dans
`DATABASE_CA_CERT`. Le script n’utilise jamais `SUPABASE_DATABASE_URL`.

Après vérification de la cible et sauvegarde approuvée, l’exploitant peut lancer
une seule fois depuis la racine du checkout Plesk :

```sh
node artifacts/api-server/scripts/seed-african-country-catalog.mjs
```

Cette commande n’est pas ajoutée au démarrage ni à l’action Git Pull : elle
effectue une écriture de production et doit rester une opération explicite. Elle
exige une connexion PostgreSQL/TLS vérifiée, verrouille la transaction, insère
uniquement les pays absents, vérifie que les 54 codes existent, puis commit.
Une erreur ou un schéma absent annule la transaction. Les erreurs n’affichent
ni chaîne de connexion ni données de ligne.

Le schéma `sf_countries` doit déjà exister. Ce seed ne crée pas de tables, ne
modifie pas les migrations, ne change pas les pays existants et n’active aucun
paiement. Si la table n’existe pas sur Plesk, il faut d’abord appliquer la
migration de schéma approuvée via le processus de migration de production.
