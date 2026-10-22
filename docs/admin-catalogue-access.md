# Accès administrateur au catalogue

Cet accès concerne **les opérateurs, leurs logos et leurs tarifs uniquement**. Il n’ouvre
pas les fonctions financières, les comptes clients, les bannières ou les protections réseau.
Les sessions clients, y compris celles des comptes ayant un rôle administrateur, ne donnent
aucun droit d’administration. Une nouvelle session administrateur exige un code eSMS
de finalité `admin_login`, puis un PIN administrateur individuel de huit chiffres.

## Activation autorisée, hors aperçu partagé

Aucune promotion de compte et aucune migration de production ne sont automatiques.
L’aperçu partagé Neon continue de refuser toutes les routes d’administration et tous
les appels SMS réels. Ne pas enlever cette protection pour tester.

Un responsable autorisé doit :

1. Appliquer uniquement `lib/db/migrations/2026-10-22-admin-access.sql` sur la base cible,
   après sauvegarde et répétition en environnement isolé.
2. Utiliser un propriétaire distinct du compte PostgreSQL de l’application. Appliquer
   `scripts/admin-access-permissions.sql` avec `psql -X -v ON_ERROR_STOP=1
   -v app_role=ROLE_APPLICATION -f scripts/admin-access-permissions.sql`.
   Le rôle applicatif doit avoir accès aux sessions, défis SMS et journaux existants,
   mais ne doit pouvoir ni modifier les droits administrateurs ni modifier/supprimer les audits.
   Ne pas utiliser une connexion propriétaire pour le serveur.
3. Identifier un compte SendFlow actif, confirmer l’identité du titulaire et obtenir
   l’autorisation explicite de lui attribuer les droits de catalogue. Aucun compte par défaut.
4. Depuis un terminal d’exploitation de confiance, avec la connexion propriétaire
   configurée de manière sécurisée dans `DATABASE_URL`, fournir le PIN **sur stdin**,
   jamais comme argument de commande ni dans le dépôt. Exemple bash :

   ```bash
   read -r -s -p 'PIN administrateur (8 chiffres) : ' ADMIN_PIN; printf '\n'
   printf '%s' "$ADMIN_PIN" | node artifacts/api-server/scripts/provision-admin.mjs \
     --apply --user-id ID_COMPTE --permission write --reason 'Autorisation explicite de gestion du catalogue'
   unset ADMIN_PIN
   ```

   `read` accorde uniquement la consultation ; `write` autorise aussi les modifications.
   Le PIN est haché avec scrypt et un sel aléatoire, indépendamment du PIN client.
   Le script exige le propriétaire et refuse l’aperçu partagé.
5. Avec eSMS Verify et les origines autorisées réellement configurés, ouvrir
   `/DMgrgmt-1np5g23g12bGFtMwh/sign-in`, saisir le numéro international exact, le code
   reçu, puis le PIN. La connexion ouvre directement « Opérateurs et tarifs ».

## Durée, révocation et journalisation

- Cookie administrateur `__Host-`, Secure, HttpOnly, SameSite Strict, distinct du cookie client.
- Session maximale d’une heure ; déverrouillage PIN de quinze minutes, sans dépasser la session.
- Les rôles, l’état actif du compte et leur version sont relus à chaque requête.
- Une modification du PIN ou du rôle invalide les anciennes sessions grâce à la version
  d’autorisation renouvelée en base. Une suspension du compte bloque aussi l’accès.
- Les tentatives PIN sont sérialisées et limitées par compte et demandeur.
- Un défi SMS est lié au numéro, au demandeur, à sa finalité et à son expiration,
  et consommé une seule fois dans la transaction créant la session.
- Pour révoquer : même script avec `--permission revoke` (sans PIN sur stdin).
  Les sessions sont révoquées dans la même transaction que le journal.
- Les connexions, déconnexions, PIN et changements de droits sont audités sans code ni PIN.
  Les modifications de logos/tarifs conservent leur contrôle de version et leur audit transactionnel.

## Vérifications locales sans SMS ni données réelles

`pnpm --filter @workspace/api-server run test:admin-access:isolated` lance un PostgreSQL
jetable sans TCP et des requêtes HTTP contre les vrais modules du catalogue.
Les défis déjà validés sont des fixtures isolées ; aucun SMS payant n’est envoyé.
