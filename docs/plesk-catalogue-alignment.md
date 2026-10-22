# Alignement Plesk / Replit — catalogue et routage

## Conclusion du contrôle du 22 octobre 2026

**Alignement non démontré : ne pas autoriser une bascule sur ce seul rapport.**
Le schéma Neon contient les nouveaux objets, mais la version réellement exécutée
par Plesk et son rôle PostgreSQL ne sont pas accessibles depuis cet environnement.
Ce rapport distingue les preuves obtenues des contrôles encore nécessaires.
Aucun déploiement, changement de droits, migration ou changement de données n'a été réalisé.
Les paiements et le provisionnement d'administrateurs sont hors périmètre.

### Preuves obtenues

| Contrôle | Observation | Portée / limite |
|---|---|---|
| Accès Plesk | Aucun accès serveur autorisé ni intégration Plesk disponible dans cette session | Impossible de lire le processus, sa release ou son environnement |
| Déploiement Replit | Le service de déploiement indique aucun déploiement Replit actif | Ne dit rien de l'hébergement externe Plesk |
| Domaine de configuration mobile `app.africa.sendflow.africa` | Les GET `/api/healthz` et `/api/auth/countries` n'aboutissent pas ; curl indique une résolution DNS impossible | Domaine trouvé dans `.env.capacitor`, pas une URL Plesk confirmée ; ne prouve pas une panne mondiale |
| Version backend Plesk | Inconnue | Aucun SHA, bundle, manifeste ni réponse HTTP exploitable obtenu |
| Neon | Connexion via le secret existant, transaction `READ ONLY`, délai SQL limité, fin par `ROLLBACK` | Base externe ; ne pas confondre avec la base gérée Replit |
| Schéma | `sf_countries`, `sf_operator_catalog`, ancienne et nouvelle tables de routage, `sf_payment_aggregators` présentes | Présence ≠ migration intégralement validée ni compatibilité du runtime |
| Colonnes | Trois booléens d'opération sur pays et opérateurs, défaut `false` ; colonne `operation` sur le nouveau routage | Contraintes, index et état fonctionnel détaillé contrôlés par le script joint |
| Rôle disponible depuis Replit | `neondb_owner`, propriétaire des cinq tables ci-dessus ; SELECT/INSERT/UPDATE/DELETE et USAGE `public` accordés ; RLS désactivée sur ces tables | **Pas de preuve que Plesk utilise ce rôle** |
| Attributs de ce rôle | Non superutilisateur, mais CREATEDB, CREATEROLE et BYPASSRLS | Ce n'est pas un login runtime restreint ; aucun droit modifié |

Les contrôles complémentaires du script SQL et leurs résultats sont décrits plus bas.
Ne pas déduire des droits du propriétaire ceux d'un autre login, même sur la même base.
Les résultats ne contiennent ni secret, ni client, ni contenu de journal d'audit.

### Résultat du script joint sur la connexion disponible depuis Replit

Exécution réussie, transaction en lecture seule terminée par `ROLLBACK` :

- Les sept relations attendues sont présentes, dont tarification et audit.
  Le rôle disponible en est propriétaire et dispose également de TRUNCATE ;
  il appartient directement à `neon_auth` et `neon_superuser`.
- Les sept colonnes attendues sont présentes et non nullables. Les contraintes
  pays et d'opération contrôlées sont validées ; l'index unique
  `(scope_type, scope_key, operation)` et l'index pays sont valides.
- Neuf pays sont activés au niveau catalogue, mais **aucune des trois opérations
  n'est activée** pour ces pays.
- Vingt-deux opérateurs sont présents, tous désactivés, avec les trois opérations
  désactivées ; aucun n'est associé à un pays absent.
- Les regroupements de routes et la comparaison ancien/nouveau sont vides :
  **les deux tables de routage sont actuellement vides**. Cela ne constitue pas
  une preuve d'alignement du code Plesk et ne simule pas un routage opérationnel.

Cet état est une observation ponctuelle de configuration partagée, pas une
autorisation d'activer un pays, un opérateur ou une opération.

## Contrat attendu d'après le code Replit

- `lib/db/migrations/2026-10-22-country-operations-and-routing.sql` :
  création additive du catalogue pays, ajout des trois indicateurs opérateurs à `false`,
  nouvelle table `sf_operation_aggregator_routes`. La copie de l'ancien routage vers
  les trois opérations ne se fait **qu'à la création initiale de cette table**.
  Une relance ne répare pas une copie incomplète si la table existe déjà.
  `IF NOT EXISTS` n'est pas une vérification de conformité du schéma.
- `lib/db/src/schema/payment-aggregator-routing.ts` : le symbole
  `paymentAggregatorRoutesTable` cible la **nouvelle** table ; le nom TypeScript
  seul ne prouve pas qu'un bundle Plesk cible cette table.
- `artifacts/api-server/src/routes/country-management.ts` : `/api/auth/countries`
  lit le catalogue SQL, renvoie `operations.deposit`, `interNetwork`, `international`
  et ne met pas la réponse en cache. Les pays désactivés restent dans cette réponse :
  les consommateurs doivent respecter `enabled`.
- `routes/admin-aggregators.ts` : lecture/écriture par
  `(scope_type, scope_key, operation)`, défaut pays et exception opérateur ;
  `aggregatorCode: null` signifie héritage du défaut pays pour un opérateur.
  Contrôle optimiste de version, conflit HTTP 409 et écriture d'audit transactionnelle.
- `services/transfer-quote.ts` : contrôle des indicateurs du pays **et** de chaque
  opérateur concerné, du numéro et du tarif. Ce service ne sélectionne pas un
  agrégateur et n'exécute pas un paiement. La configuration de routage et la
  disponibilité d'une intégration ne sont pas équivalentes.
- Trois opérations indépendantes : `deposit`, `inter-network`, `international`.
  « Retrait » désigne l'international. Pas de bascule automatique de fournisseur.

### Risque de coexistence

L'ancienne table `sf_payment_aggregator_routes` reste intacte : ni synchronisation
bidirectionnelle, ni double écriture, ni garantie de retour arrière fonctionnel.
Une ancienne API peut continuer à réussir tout en ignorant les nouveaux pays,
indicateurs ou choix par opération. Un `/healthz` positif, qui renvoie seulement
`status: ok`, ne constitue pas une attestation de version ou de base.
Une fois les opérations différenciées, **trois choix ne se réduisent pas sans perte
à une seule ancienne route**.

## Contrôles à exécuter côté Plesk avant décision

À confier à l'exploitant autorisé, sans copier de secret dans le chat ou les logs :

1. Confirmer l'URL et la chaîne proxy de production depuis Plesk/DNS.
   Identifier l'application Node, le répertoire de release, le fichier de démarrage,
   le Node exécuté, les workers et les tâches planifiées, pas seulement le dépôt Git.
2. Dans la release : relever `git rev-parse HEAD` et l'état de travail si Git existe ;
   relever `sha256sum` du **bundle effectivement démarré** et son manifeste de build.
   Comparer avec le bundle d'une build propre de la révision candidate, pas avec un
   bundle reconstruit avec d'autres dépendances. Sans manifeste, la version exacte
   reste non prouvée. Ne pas afficher l'environnement complet du processus.
3. Vérifier seulement les valeurs non sensibles : `NODE_ENV=production`,
   `SENDFLOW_DATABASE_TARGET=production`, `TRUST_PROXY_HOPS` adapté à la chaîne réelle,
   `CORS_ALLOWED_ORIGINS` HTTPS exactes ; présence des secrets requis, jamais leur valeur.
   Le chemin de connexion Plesk doit être celui du runtime, pas celui du migrateur.
4. Avec les paramètres sécurisés du **login réellement utilisé par ce processus**,
   exécuter `scripts/plesk-catalogue-readonly.sql`. Utiliser `psql -X`
   avec `--set=ON_ERROR_STOP=1 --file=scripts/plesk-catalogue-readonly.sql`.
   Injecter les paramètres depuis le gestionnaire de secrets approuvé :
   aucune URL/mot de passe en argument, historique shell ou sortie.
   Vérifier hors journal que la cible est la base Neon approuvée.
   Ne pas changer de rôle pour obtenir artificiellement un résultat favorable.
5. Le script ouvre une transaction en lecture seule et la ferme par `ROLLBACK` ;
   il lit attributs du rôle, appartenances, droits effectifs de table, colonnes,
   contraintes/index et agrégats de configuration. Une table/colonne ou permission
   manquante fait échouer les lectures détaillées ; arrêter, ne pas accorder de droits.
   Les droits de colonne seuls et les politiques RLS demandent une analyse spécifique :
   la matrice des droits de table ne remplace pas un essai fonctionnel isolé.
6. Comparer les réponses publiques du domaine confirmé au catalogue SQL au même
   instant, sans authentification réelle ni appels de devis en production.
   Une erreur DNS, un 503 catalogue, une forme ancienne ou une divergence de version
   est bloquante. Écarter les caches proxy et vérifier tous les workers.

### Droits minimaux à soumettre pour approbation, pas à appliquer ici

| Objet | Besoin de ces routes |
|---|---|
| Schéma `public` | USAGE |
| `sf_countries`, `sf_operator_catalog` | SELECT, INSERT, UPDATE |
| `sf_operation_aggregator_routes`, `sf_payment_aggregators` | SELECT, INSERT, UPDATE |
| `sf_operator_pricing_rates` | SELECT et droits existants des routes de tarification, à conserver explicitement |
| `sf_admin_audit_logs` | INSERT pour ces routes, y compris certaines lectures administrateur auditées ; conserver SELECT seulement si nécessaire aux autres routes autorisées |

Ces objets utilisent des UUID, pas une nouvelle séquence SERIAL à autoriser.
Ni DELETE/TRUNCATE ni propriété ne sont nécessaires à ces modifications de catalogue.
Les nouvelles tables n'héritent pas nécessairement des droits des anciennes :
examiner leurs ACL effectives et les default privileges du propriétaire.
Le login API devrait être dédié, sans propriété ni CREATEDB/CREATEROLE/BYPASSRLS,
conformément à `docs/security/financial-activation-runbook.md`.
Toute création/bascule de rôle et tout GRANT/REVOKE exigent une autorisation
séparée et une revue de **toutes** les fonctions du runtime ; pas de changement global.

## Plan coordonné, conditionné à une autorisation explicite

1. **Décision préalable** : collecter les preuves Plesk ci-dessus, fixer une révision
   candidate immuable, ses empreintes et la release précédente, inventorier tous
   les consommateurs de Neon (Plesk, Replit partagé, workers, anciens serveurs).
   Sans version et rôle confirmés : NO-GO.
2. **Préparation hors production** : build verrouillée avec le lockfile, tests sur
   base jetable, sans SMS/Didit ni sortie fournisseur. Vérifier la migration depuis
   un ancien schéma, sa relance et le cas table de routage déjà présente.
   Valider l'héritage pays/opérateur, les trois opérations indépendantes, les 409,
   l'audit atomique et le rejet des devis désactivés, sans transfert réel.
3. **Sauvegarde et fenêtre** : s'appuyer sur les travaux existants de sauvegarde
   restaurable et de maintenance ; obtenir leur feu vert. Sauvegarder le schéma,
   les ACL et le catalogue/routage (ancien et nouveau), versions comprises, dans
   un stockage protégé. Définir responsable, durée et critères d'arrêt.
4. **Gel coordonné** : arrêter les écritures de catalogue/routage et les chemins
   financiers exposés sur **toutes** les versions et workers, pas seulement l'UI.
   Ne pas supposer qu'un mécanisme de maintenance non activé protège la base.
5. **Schéma et droits** : inspecter le réel avant toute action. Le schéma observé
   est déjà présent : ne pas relancer la migration par réflexe. Si un écart est
   confirmé, soumettre une correction additive ciblée et ses droits explicites ;
   attendre l'autorisation. Pas de push Drizzle global ni modification de l'ancien routage.
6. **Livraison** : après accord, installer backend, contrats générés et frontend
   compatibles issus de la même release ; conserver l'ancienne release immuable.
   Arrêter/remplacer tous les anciens workers puis redémarrer avec la configuration
   revue. Aucun mélange durable de versions lisant des tables différentes.
7. **Recette avant réouverture** : vérifier empreintes du code réellement démarré,
   login SQL réel, script lecture seule, catalogue public et absence de 503/erreurs
   de permission dans des journaux expurgés. Les tests authentifiés modifiant l'audit
   restent isolés ; toute recette modifiante en production exige son propre accord.
   Aucun pays/opérateur/opération n'est activé automatiquement.
8. **Réouverture approuvée** : seulement si toutes les preuves concordent ;
   surveiller erreurs SQL, catalogue, versions conflictuelles et échecs de devis,
   sans journaliser numéros, jetons ou corps sensibles.

## Retour arrière

- **Déclencheurs** : version/empreinte inattendue, droit SQL manquant, catalogue
  divergent, opération ignorée, erreurs 503, données incohérentes ou audit défaillant.
  Maintenir/rétablir le gel sur tous les consommateurs avant toute intervention.
- **Option privilégiée** : revenir à une release déjà compatible avec le nouveau
  schéma/routage, avec backend et frontend appariés. Vérifier ses empreintes et
  refaire les contrôles en lecture seule avant réouverture.
- **Ancienne release seulement** : ne pas la rouvrir automatiquement. Comparer
  l'ancien routage aux trois nouveaux choix, ainsi que pays/opérateurs et indicateurs.
  Même une comparaison sans divergence ne prouve pas que l'ancien code respecte
  les indicateurs : son comportement doit être validé en environnement isolé.
  Si l'ancien code ne sait pas appliquer les restrictions, garder le service fermé.
- **Divergences après bascule** : aucune copie automatique nouveau → ancien.
  Conserver les deux états et l'audit ; faire approuver chaque éventuelle
  réconciliation métier et modification de données. Ne pas restaurer toute Neon
  pour un incident de catalogue : cela pourrait effacer des activités légitimes.
- **Base et droits** : ne supprimer ni tables ni colonnes additives ; ne pas annuler
  aveuglément les grants ni réintroduire un login propriétaire. Toute restauration
  ciblée ou modification de droits est une opération distincte à autoriser.
- **Fin du retour arrière** : état cohérent, restriction par opération démontrée,
  rôle/versions confirmés, absence d'anciens workers et accord de réouverture.

## Éléments restant à obtenir

L'exploitant doit fournir par le canal approuvé : domaine confirmé, manifeste et
empreinte de la release en cours, cible/processus Plesk, rapport SQL exécuté par
son login runtime. Ne jamais transmettre son fichier `.env` ou des identifiants.
Tant que ces preuves manquent, le contrôle de la **version Plesk et de ses droits**
reste explicitement non conclu, même si le plan et les contrôles sont prêts.
