# Activation ciblée des protections financières SendFlow

Date : 22 octobre 2026. **Préparation seulement — aucune autorisation d’intervention réelle.**

## 1. État livré et limites

Cette procédure complète [le rapport de sécurisation](sendflow-financial-hardening-2026-10-22.md).
Elle prépare exclusivement :

- `lib/db/migrations/2026-10-22-financial-audit-hardening.sql` ;
- les ACL de `public.sf_wallet_ledger`, `public.sf_admin_audit_logs` et
  `public.sf_api_request_limits`, ainsi que le retrait de `CREATE` sur le schéma `public` ;
- le retrait d’`EXECUTE` direct sur les deux fonctions trigger de protection preview
  existantes, **sans supprimer ni modifier leurs triggers ou leur corps** ;
- la séparation entre le propriétaire de migration et le login utilisé par l’API.

**Non effectués :** connexion à Neon/Plesk, lecture du schéma réel, sauvegarde réelle,
restauration réelle, changement de rôle ou de secret réel, migration réelle, déploiement.
Les preuves locales utilisent un cluster jetable, des lignes synthétiques et des clés de test
sans héritage des secrets de l’environnement. Elles ne prouvent pas l’état de la production.

Aucun fichier runtime ni page client n’est modifié par cette préparation. Ni les protections
de preview, ni la fermeture des transferts/dépôts et de l’administration ne doivent être levées.
Un devis ne réserve ni ne transfère de fonds.

## 2. Autorisations et conditions bloquantes

Obtenir un accord explicite **avant toute connexion réelle**, distinguant :

1. lecture des catalogues et inventaire des droits, sur une cible nommée ;
2. sauvegarde et restauration dans un environnement isolé à accès restreint ;
3. fenêtre de maintenance, migration ciblée, modification des ACL et bascule du serveur.

L’option `approve_permissions=yes` est un garde-fou technique, **pas** une autorisation.
Ne pas exécuter les exemples ci-dessous dans cet espace de travail sans cet accord.

Fiche de changement à compléter et signer par l’exploitant et un second lecteur :

| Champ | Valeur à renseigner avant exécution |
|---|---|
| Cible | Infrastructure, projet/branche, hôte, base, schéma `public`, version PostgreSQL |
| Clients de cette base | Plesk, preview Replit, anciennes API, workers, traitements planifiés, outils DBA |
| Rôles | Login API réellement utilisé par chaque client ; propriétaire/migrateur distinct |
| Versions | Révision serveur actuelle, révision candidate, empreinte SHA-256 des SQL approuvés |
| Récupération | Identifiant de sauvegarde, emplacement chiffré hors dépôt, clé accessible séparément |
| Objectifs | RPO = aucune écriture perdue pendant la bascule ; RTO mesuré lors de la répétition |
| Fenêtre | Début/fin en UTC, délai maximal de verrouillage, seuil d’arrêt, responsable du retour |
| Preuves | Rapports avant/après, répétition de restauration, validations et approbations |

**Arrêt obligatoire** si une cible est incertaine, un rôle est partagé avec le propriétaire,
la restauration n’est pas démontrée, le schéma diffère, un `SECURITY DEFINER` non revu est
accessible, une application cliente n’est pas arrêtée, ou un contrôle échoue.
Ne pas remplacer ces contrôles par `drizzle-kit push`, `db push`, `--force`, ni par une
synchronisation globale. Ne pas lancer les autres migrations en lot « pour rattraper ».

## 3. Préparer la connexion et l’inventaire sans exposer les données

Utiliser `psql` 15+ et des outils `pg_dump`/`pg_restore` compatibles avec la version du serveur
(de préférence le même majeur ; `pg_dump` ne doit pas être plus ancien que le serveur).
Configurer par le canal sécurisé de l’exploitant des services libpq :

- `sendflow_change` : cible réelle, rôle propriétaire/migrateur ;
- `sendflow_app_check` : même cible, **login réellement prévu dans le pool API** ;
- `sendflow_restore` : cible isolée de répétition, jamais la base réelle.

Les noms sont des exemples, pas des services déjà installés. Ne pas mettre d’URI avec mot
de passe dans la commande, l’historique, les logs, Git ou le rapport. Ne pas copier les valeurs
des secrets Replit dans ces documents. Contrôler l’accès aux fichiers libpq et sauvegardes
(répertoire `0700`, fichiers `0600`, stockage chiffré, hors workspace partagé).

Après autorisation de lecture uniquement :

```sh
# APP_ROLE contient seulement le nom non secret du login approuvé, pas un mot de passe.
psql -X 'service=sendflow_change' -v ON_ERROR_STOP=1 \
  -v app_role="$APP_ROLE" -v phase=before \
  -f scripts/financial-activation/preflight.sql
```

Le script utilise une transaction `REPEATABLE READ READ ONLY`, puis `ROLLBACK`. Il ne lit
aucune ligne client, portefeuille ou événement. Il vérifie les tables affectées, le contrat
de types/nullabilité, les unicités immédiates et les objets additifs déjà présents.
`before` accepte l’absence des nouveaux objets, **pas un objet existant incompatible**.
Il inventorie contraintes, triggers, propriétaire/ACL et fonctions `SECURITY DEFINER`
accessibles au login. **Le succès de `before` ne valide pas les droits existants.**

Les fonctions existantes `public.sf_guard_preview_password()` et
`public.sf_guard_preview_session()` sont des triggers `SECURITY DEFINER` avec `EXECUTE`
initialement accordé à `PUBLIC`. Le script de permissions retire ce droit direct à `PUBLIC`
et au login API avant le contrôle strict. PostgreSQL vérifie `EXECUTE` à la création du
trigger, pas à chaque déclenchement : les protections déjà installées restent actives.
Les tests isolés vérifient explicitement le refus des identifiants/sessions hors preview
après ce retrait. Le script ne crée pas ces fonctions si elles sont absentes.

Conserver aussi un export de schéma/ACL seul dans l’espace sécurisé :

```sh
umask 077
pg_dump --dbname='service=sendflow_change' --schema-only --file="$SECURE_DIR/before-schema.sql"
sha256sum lib/db/migrations/2026-10-22-financial-audit-hardening.sql \
  scripts/financial-activation/*.sql
```

### Revue humaine indispensable du schéma réel

Le contrôle automatique est ciblé, pas un comparateur complet de tous les objets SendFlow.
Comparer l’export aux schémas dans `lib/db/src/schema/` et vérifier :

- les autres colonnes consommées par les services (monnaie, raison, auteur, timestamps,
  statut KYC, dernier webhook), leurs valeurs par défaut, enums et clés étrangères ;
- l’unicité du portefeuille par utilisateur, les clés de session/KYC, l’idempotence du ledger ;
- les contraintes de soldes/montants et de réconciliation du ledger issues des deux
  migrations `2026-10-09-wallet-*-checks.sql` : **lire leurs définitions**, pas seulement les noms ;
- `NOT VALID` signifie que les nouvelles écritures sont contraintes mais que l’historique
  n’est pas certifié. Ne pas lancer un scan/`VALIDATE CONSTRAINT` de l’historique dans ce lot ;
- toute fonction/trigger préexistant homonyme ou dépendance supplémentaire : ne pas écraser
  un objet étranger à SendFlow ; toute table partitionnée/héritée nécessite une revue dédiée ;
- les ACL de colonnes, les grants à `PUBLIC`, les appartenances de rôles (même `NOINHERIT`),
  les privilèges sur les paramètres et les routines élevées ;
- les droits nécessaires aux autres routes déjà actives (authentification/PIN, sessions,
  reçus Didit, configurations/prix). Ne pas ouvrir l’administration pour les vérifier.

En cas de dérive : arrêt, rapport précis, nouvelle migration ciblée revue et nouvel accord.
Le SQL additif ne répare pas un `IF NOT EXISTS` pointant vers un objet mal défini.

## 4. Séparer les rôles avant la bascule

Le login API doit être un rôle dédié `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
NOREPLICATION NOBYPASSRLS`, **sans appartenance à d’autres rôles**, même `NOINHERIT`.
Cette exigence conservatrice exclut aussi les rôles prédéfinis donnant accès global aux
données et les chemins de `SET ROLE` vers un propriétaire.

Il ne doit posséder ni la base, ni un schéma, une relation ou une fonction, ni avoir `CREATE`
dans la base ou un schéma persistant. Interdire `SET`/`ALTER SYSTEM` sur
`session_replication_role`. Les fonctions `SECURITY DEFINER` non système exécutables sont
bloquantes : revue et retrait ciblé d’`EXECUTE` après accord, pas de suppression globale.
Le script refuse ces situations ; il ne tente pas de rétrograder automatiquement un propriétaire.

Si l’API utilise aujourd’hui un propriétaire : créer un nouveau login via la gestion sécurisée
des accès, préparer une matrice explicite des droits nécessaires aux routes actives et basculer
les pools Plesk **et preview** vers ce login pendant la maintenance. Ne pas transformer le
propriétaire en rôle API, ni utiliser `REASSIGN OWNED`/`REVOKE ALL ON ALL TABLES` aveuglément.
Garder les identifiants du migrateur hors des processus API ; retirer aussi l’ancien accès
propriétaire de tous les services/anciens pools, sans l’afficher.

La matrice ajoutée par ce lot est :

| Objet | Droits API nécessaires | Interdits |
|---|---|---|
| `public` | `USAGE` | `CREATE` |
| Ledger et audit | `SELECT`, `INSERT` | `UPDATE` table **et colonnes**, `DELETE`, `TRUNCATE`, `TRIGGER`, propriété |
| Quota | `SELECT`, `INSERT`, `UPDATE` pour l’upsert | Aucun droit propriétaire/DDL |
| KYC et reçus | Droits déjà requis sur les tables existantes, y compris les colonnes ajoutées | Élargissement global des droits |
| Fonctions trigger preview nommées ci-dessus | Déclenchement existant maintenu | `EXECUTE` direct via le login API ou `PUBLIC` |
| Autres objets | Conserver seulement la matrice existante revue, ne pas accorder `ALL` | Rôle propriétaire/migration dans le serveur |

Le script retire `CREATE ON SCHEMA public FROM PUBLIC` ainsi que les droits de table et
`UPDATE` de colonnes du ledger/audit à `PUBLIC`. Cela concerne **tous** les logins :
inventorier les dépendants, prévoir les grants explicites légitimes et obtenir cet accord.
Il retire ensuite les droits du login API, puis n’accorde que les droits ciblés ci-dessus.
Il n’altère ni les default privileges globaux ni les droits des autres tables.
Revoir les default privileges du propriétaire pour empêcher une future migration de
réaccorder `ALL` au runtime ; répéter le postcontrôle après chaque migration future.

## 5. Sauvegarde et répétition de restauration

1. Estimer le volume et le temps de sauvegarde/restauration hors fenêtre avant approbation.
2. Préparer une cible isolée, réseau sortant interdit, sans serveur applicatif, SMS/Didit,
   planification, emails ni accès public. Des données réelles restaurées restent sensibles.
3. Préserver les rôles propriétaires nécessaires et leurs ACL, sans exporter les mots de
   passe. Un DBA peut conserver `pg_dumpall --roles-only --no-role-passwords` dans le coffre,
   si le service le permet ; sinon documenter les rôles applicatifs/propriétaires concernés.
   Ne jamais rejouer un export global de rôles dans un autre cluster partagé.
4. Répéter la restauration et la migration sur cette cible avant d’autoriser la fenêtre.
5. Au début de la fenêtre, après arrêt effectif de **tous** les écrivains et fin de leurs
   transactions, refaire la sauvegarde finale cohérente :

```sh
umask 077
pg_dump --dbname='service=sendflow_change' --format=custom \
  --file="$SECURE_DIR/before-financial-hardening.dump"
sha256sum "$SECURE_DIR/before-financial-hardening.dump"
pg_restore --list "$SECURE_DIR/before-financial-hardening.dump"
# Seulement dans une base isolée vide avec rôles correspondants déjà préparés :
pg_restore --dbname='service=sendflow_restore' --exit-on-error --single-transaction \
  "$SECURE_DIR/before-financial-hardening.dump"
```

Ne pas utiliser `--no-owner`/`--no-acl` silencieusement : cela masque les incompatibilités.
Si le service impose un mapping de propriétaires, documenter et vérifier explicitement ce
mapping dans la répétition. `pg_restore --list` seul **n’est pas** une preuve de restauration.

Sur la restauration : comparer schéma, propriétaires, ACL, contraintes, triggers, comptes
de lignes et empreintes protégées des tables concernées, sans publier de contenu ni de
digest de données personnelles ; mesurer le RTO. Vérifier séparément que les clés de
chiffrement historiques sont récupérables via le coffre, sans les copier avec la sauvegarde.
Conserver seulement le verdict et les identifiants protégés des preuves dans le compte rendu.
Appliquer ensuite la migration et les permissions sur cette copie et répéter les contrôles.

Le test local fourni démontre une restauration technique de **données synthétiques** avec
propriétaires/ACL et comparaison exacte des historiques ; il ne remplace pas cette répétition réelle.

## 6. Fenêtre : migration → permissions → serveur

Prévoir le temps mesuré de sauvegarde + migration + ACL + contrôles + bascule + restauration,
avec marge. Aucun minutage arbitraire ne remplace la mesure sur la copie représentative.

1. Poser une maintenance à l’entrée des API mutatrices. Arrêter toutes les versions de l’API,
   les pools preview, workers et tâches pouvant écrire dans la base partagée. Drainer les
   transactions ; vérifier les sessions/transactions restantes via l’exploitant.
   Ne pas simplement changer un drapeau frontend ou ouvrir un contournement de preview.
2. Suspendre proprement la réception webhook : réponse de maintenance non-2xx et reprise
   conforme aux retries du fournisseur, jamais un faux succès `200` qui perdrait un événement.
   Consigner l’heure et la procédure de reprise ; ne pas envoyer de webhook live de test.
3. Capturer le schéma/ACL final et la sauvegarde finale, vérifier leur restauration.
4. Avec le propriétaire/migrateur approuvé, **uniquement après accord d’exécution** :

```sh
psql -X 'service=sendflow_change' -v ON_ERROR_STOP=1 \
  -f lib/db/migrations/2026-10-22-financial-audit-hardening.sql
```

   Ce fichier gère sa transaction et son `lock_timeout=5s`. Il ajoute le quota, cinq colonnes
   nullable et les quatre triggers ; aucune donnée historique n’est réécrite/déchiffrée.
   Les verrous DDL peuvent bloquer : en cas d’échec/timeout, garder la maintenance et
   identifier la cause, ne pas boucler, forcer ou désactiver les triggers.
   Ne pas l’envelopper dans `psql --single-transaction` : il contient déjà `BEGIN/COMMIT`.
5. Exécuter le script de permissions approuvé, dans sa transaction distincte :

```sh
psql -X 'service=sendflow_change' -v ON_ERROR_STOP=1 \
  -v app_role="$APP_ROLE" -v approve_permissions=yes \
  -f scripts/financial-activation/permissions.sql
```

   Une erreur annule ses ACL, **pas la migration déjà committée**. Maintenir la fermeture
   jusqu’à correction revue. Le script contrôle le schéma migré, l’absence de contournement
   du rôle et les droits effectifs après retrait, y compris `PUBLIC` et `UPDATE(colonne)`.
6. Postcontrôles sans écriture de données financières :

```sh
psql -X 'service=sendflow_change' -v ON_ERROR_STOP=1 \
  -v app_role="$APP_ROLE" -v phase=after -f scripts/financial-activation/preflight.sql
# Refaire le même contrôle avec la véritable connexion API limitée :
psql -X 'service=sendflow_app_check' -v ON_ERROR_STOP=1 \
  -v app_role="$APP_ROLE" -v phase=after -f scripts/financial-activation/preflight.sql
```

   Confirmer que `inspecting_role` du second rapport est exactement `$APP_ROLE`.
   `after` vérifie types/nullabilité, PK/check du quota, fonctions/triggers attendus et activés,
   rôle sans élévation et droits effectifs. Aucun `DELETE`, `TRUNCATE`, `UPDATE` « dans un
   rollback » ne doit servir de sonde contre la base réelle.
7. **Puis seulement** démarrer le serveur candidat avec le login limité et sa configuration
   de production existante. Sur Plesk, préserver `NODE_ENV=production`,
   `SENDFLOW_DATABASE_TARGET=production`, les origines CORS HTTPS et `TRUST_PROXY_HOPS` exacts.
   En preview conserver `shared-neon` et tous ses filtres ; ne jamais y forcer `production`
   ou `development` pour contourner une erreur. Aucun changement de configuration de prix,
   de fournisseur, de compte viewer ou de rôle administrateur dans ce lot.
8. Vérifier `/api/healthz`, démarrage sans erreur de schéma/permission et absence d’URI ou de
   données sensibles dans les logs. La santé seule ne prouve pas le bon accès SQL.
   Vérifier le refus des accès privés sans session, l’administration toujours fermée,
   l’absence de route de mutation des transferts et le filtrage preview, sans session client
   réelle ni tentative de paiement. La couverture des parcours avec écriture reste isolée.
9. Rouvrir seulement les fonctions déjà autorisées, après signatures des contrôles.
   Reprendre les webhooks sans rejouer arbitrairement l’historique ; surveiller erreurs SQL
   `42501`/`23514`, événements retenus et taux de refus de quota sans journaliser leurs payloads.
   **Les transferts et l’administration restent fermés**, même si tous les contrôles passent.

Ne pas autoriser le démarrage « serveur d’abord » : les nouvelles colonnes et le quota sont
nécessaires aux chemins KYC/devis. Le fail-closed ne constitue pas un plan de disponibilité.

## 7. Arrêt et retour arrière

| Situation | Action |
|---|---|
| Précontrôle/sauvegarde/restauration en échec | Ne rien migrer ; rester sur la version précédente |
| Migration échoue avant `COMMIT` | Transaction annulée ; examiner les catalogues en lecture seule |
| ACL échouent après migration | Migration conservée, serveur arrêté, ACL annulées ; traiter la cause avant reprise |
| Nouveau serveur en échec | Arrêter le candidat, conserver maintenance et protections SQL |
| Besoin de revenir au serveur précédent | Seulement si cette version a réussi la répétition avec schéma additif et login limité ; sinon ne pas la démarrer |
| Restauration nécessaire | Nouvelle autorisation explicite, restauration vers une nouvelle cible isolée, vérification puis bascule contrôlée |

Pas de « down migration » automatique : ne pas supprimer quota, colonnes, reçus ou triggers.
Une ancienne version ne doit pas retrouver des droits de modification de l’historique pour
redémarrer. Si elle en dépend, le retour n’est pas compatible et la maintenance continue.

Pour restauration complète : arrêter tous les écrivains, conserver une sauvegarde de l’état
en échec pour analyse restreinte, restaurer l’archive préfenêtre dans une **nouvelle** base,
reconstituer les rôles/ACL via le DBA, valider les empreintes/comptes et la configuration des
clés. Changer la cible uniquement après accord, puis redémarrer la version compatible.
La sauvegarde préfenêtre ne contient pas les écritures acceptées après reprise : si des
écritures ont repris, **interdiction de restaurer à l’aveugle** ; rapprochement et plan de
récupération/PITR spécifique à faire approuver pour éviter une perte de données.

## 8. Preuves de compatibilité reproductibles

Sans connexion réelle ni services externes :

```sh
node artifacts/api-server/tests/security/run-isolated-activation.mjs
pnpm --filter @workspace/api-server run test:finance:isolated
env -i PATH="$PATH" HOME="$HOME" bash -c \
  'cd artifacts/api-server && node --experimental-strip-types --test src/lib/shared-neon-preview-guard.test.mjs'
```

Le premier runner n’accepte aucune URL. Il crée son propre cluster/socket Unix privé, sans
écoute TCP, exporte uniquement le schéma Drizzle local (pas un push), construit l’ancien
contrat, puis détruit le cluster et l’archive à la fin. Son environnement enfant ne contient
ni les URL ni les secrets du workspace.

Résultats constatés lors de cette préparation :

| Preuve locale | Résultat |
|---|---|
| Précontrôle ancien schéma en lecture seule, type additif incompatible refusé | Réussi |
| Table quota partielle ou héritage de table d’historique refusés | Réussi |
| Sauvegarde/restauration synthétique avec historique exact et propriétaire/ACL préservés | Réussi |
| Migration exécutée deux fois et sur la copie restaurée, historique inchangé | Réussi |
| Approbation manquante, rôle élevé/propriétaire, appartenance `NOINHERIT`, droit de réplication et fonction élevée refusés | Réussi |
| Retrait effectif `PUBLIC` et droits UPDATE de colonnes, seconde exécution sans dérive | Réussi |
| Refus SQL `UPDATE/DELETE/TRUNCATE` des deux tables par le login limité | Réussi, code `42501` |
| Désactivation/suppression de trigger, remplacement de fonction et changement de réplication refusés | Réussi |
| Triggers actifs bloquant même le DBA ; trigger désactivé ou fonction altérée détectés | Réussi |
| Triggers preview toujours actifs après retrait d’EXECUTE direct | Réussi |
| Append ledger/audit et upsert quota possibles ; valeur 61 refusée | Réussi |
| Suite API/SQL financière existante, avec le vrai script d’ACL plutôt qu’un REVOKE simulé | 14/14 réussis |
| Tests unitaires de la fermeture preview | 4/4 réussis |

Soit **15 groupes de contrôles d’activation**. Aucun résultat ci-dessus ne certifie les droits,
la sauvegarde ou les performances de la base réelle. Compléter la fiche de changement avec
les résultats réels **après autorisation**, avant toute décision de mise en service.

Environnement local vérifié : PostgreSQL/psql 16.15. Les scripts exigent PostgreSQL 15+
mais aucune autre version n’a été qualifiée ici. Aucun test navigateur connecté n’a été
lancé. La capture publique n’était pas disponible dans cet environnement ; aucun fichier
frontend, runtime, configuration de workflow ou migration existante n’a été modifié.
