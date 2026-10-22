# SendFlow — premier lot de sécurisation financière

Date : 22 octobre 2026.

## Périmètre respecté

- Corrections serveur, schéma/migration PostgreSQL, contrat API et tests.
- Aucun composant, page, style ou comportement visuel de SendFlow modifié.
- Les types de webhook et validateurs partagés ont été régénérés depuis OpenAPI ; aucune logique financière n'a été ajoutée au navigateur.
- Aucun accès de test aux données Neon réelles, aucune migration réelle, aucun SMS, appel Didit réel ou mouvement de fonds.
- Les clés réelles de l'environnement n'ont pas été copiées, affichées ou requalifiées en clés de test. Les essais utilisent exclusivement des secrets synthétiques générés dans un processus isolé.
- L'administration reste fermée ; les transferts/dépôts clients ne sont pas activés.

Ce rapport décrit un premier lot vérifié, pas une certification de sécurité ni une autorisation de mise en production.

## Cartographie réelle

```text
Pages React / TypeScript inchangées
  → API Express / session serveur / validation Zod
    → services métier (devis, ajustement interne de portefeuille)
      → accès PostgreSQL via Drizzle (prix actifs, plafonds, quota)
        → contraintes, unicité, verrous de lignes, transactions SQL

Didit → signature vérifiée côté serveur
      → contrôle du type/environnement/horodatage de l'événement
      → reçu chiffré + empreinte sémantique + statut appliqué ou retenu
      → statut KYC servant aux plafonds serveur
```

Stack confirmée : React/TypeScript, Node.js/Express, PostgreSQL/Drizzle. Pas de Supabase identifié. Les intégrations Didit/eSMS sont côté serveur. L'exécution des paiements Mobile Money n'est pas une fonctionnalité active vérifiée par ce lot.

## Compétences et méthode de sécurité

Les neuf compétences installées ont été identifiées et consultées pendant l'audit :

1. `application-security-testing` : périmètre, séparation des actifs et priorisation.
2. `find-security-vulnerabilities-in-code` : lecture des flux et frontières de confiance.
3. `api-security-testing` : authentification, IDOR, privilèges et falsification des entrées.
4. `web-app-penetration-testing` : distinction interface/autorisation réelle.
5. `owasp-top-10-testing` : accès, injection, configuration, données sensibles.
6. `penetration-testing-with-strix` : exigences de preuves et limites de l'outillage.
7. `managed-pentesting-with-strix` : conditions de téléversement, accès et crédits.
8. `fix-security-vulnerabilities-with-strix` : correction de la cause et vérification.
9. `ci-security-scanning-with-strix` : possibilités de contrôle continu, sans modification CI dans ce lot.

**Aucun pentest Strix n'a été exécuté.** Son moteur n'est pas disponible pour cette intervention. Consulter une compétence ne signifie pas avoir lancé son moteur. Les contrôles réellement exécutés sont détaillés ci-dessous.

## Constats et corrections

| Risque constaté | Gravité | Correction effectuée |
|---|---|---|
| Une ancienne approbation KYC pouvait conserver le plafond supérieur malgré une vérification ultérieure défavorable | Haute | La vérification la plus récente détermine le statut et le plafond |
| Le classement numérique des statuts Didit empêchait de retirer une approbation | Haute | Transitions explicites, retrait AML/expiration pris en compte et ordre fondé sur `created_at` signé |
| Rejeu d'événements avec même référence mais contenu différent insuffisamment distingué | Haute | Empreinte sémantique du contenu ; conflit HTTP 409 ; répétition légitime reconnue même si l'heure d'envoi change |
| Historique ledger/audit modifiable par SQL si privilèges trop larges | Haute | Migration de triggers interdisant UPDATE/DELETE/TRUNCATE ; contrepassation requise |
| La concurrence financière n'était testée que par simulation mémoire | Haute | Tests sur PostgreSQL réel jetable avec services réels, connexions concurrentes, idempotence et rollback |
| Devis sans quota persistant par utilisateur | Moyenne | Compteur atomique PostgreSQL, 60 requêtes par minute, HTTP 429 et Retry-After |
| Logique métier mêlée aux contrôleurs | Moyenne | Extraction des calculs de devis et de l'ajustement de portefeuille en services dédiés |
| Reçus webhook limités à des métadonnées | Moyenne | Conservation du contenu reçu chiffré, empreinte et résultat d'application du statut |

### Règles maintenant isolées dans les services serveur

- Calcul en unités monétaires entières, frais expéditeur/destinataire, validation des opérateurs/prix actifs et du plafond du compte authentifié.
- Ajustement de portefeuille : utilisateur/portefeuille actifs, verrous SQL, solde attendu, contrôle d'entiers sûrs, unicité/idempotence et audit dans la même transaction.
- Refus d'une seconde mutation si le solde a changé, d'un solde négatif ou d'un résultat hors plage.
- Aucun montant de frais, total, rôle, identifiant utilisateur ou statut financier fourni par le navigateur n'est une autorité.

L'ajustement interne existait déjà ; il n'est pas rendu accessible par cette extraction. Les ajustements d'utilisateurs suspendus sont désormais refusés en plus de ceux des comptes supprimés, pour ne pas contourner la suspension.

### Routes vérifiées ou renforcées

| Route | Contrôles et résultat réel |
|---|---|
| `POST /api/me/transfer-quote` | Session, PIN récent, Zod, prix/plafond serveur, quota persistant ; aucune création de transfert |
| `GET /api/me/transactions/:transactionId` | Accès propre autorisé ; ressource d'autrui HTTP 404 |
| Routes d'administration existantes | Porte d'accès inchangée, fermée HTTP 503 ; aucune ouverture de privilèges |
| Modification directe d'un statut de transaction client | Aucune route PATCH acceptée ; HTTP 404 |
| `POST /api/webhooks/didit` | Signature existante conservée, environnement/type validés, date de modification signée, idempotence, ordre et reçus chiffrés |

## Principaux fichiers et changements réels

- `artifacts/api-server/src/services/transfer-quote.ts` : service de devis.
- `artifacts/api-server/src/data/transfer-quote.ts` : chargement des paramètres fiables.
- `artifacts/api-server/src/data/transfer-quote-quota.ts` : quota atomique.
- `artifacts/api-server/src/services/wallet-adjustment.ts` : transaction financière atomique ; appelée par la route existante d'administration.
- `artifacts/api-server/src/data/identity-verification.ts` et `src/lib/account-limit.ts` : dernier KYC comme source de décision.
- `artifacts/api-server/src/lib/didit-verification-policy.ts` : politique de transitions et d'ordre.
- `artifacts/api-server/src/lib/identity-webhook-receipt.ts` : chiffrement, empreinte et validation de date.
- `artifacts/api-server/src/routes/identity-verification.ts` : traitement transactionnel du webhook.
- `lib/db/src/schema/` : quota, informations d'événement et dernier horodatage appliqué.
- `lib/db/migrations/2026-10-22-financial-audit-hardening.sql` : nouvelle migration additive ; aucune ancienne migration réécrite.
- `lib/api-spec/openapi.yaml` : réponse 429 et date d'événement webhook requise ; génération des validateurs/types.
- `artifacts/api-server/tests/security/` et tests de services : tests réels et simulations clairement distincts.

Les changements runtime essentiels sont l'extraction des services, le remplacement de l'approbation historique par le dernier KYC, le remplacement du classement numérique des statuts par une politique ordonnée et l'ajout de protections SQL. Aucune suppression de page.

## Migration et permissions

**Migration préparée et testée, NON appliquée à Neon ni à la production.**

Le serveur mis à jour nécessite cette migration avant activation des routes concernées sur une base réelle. En son absence, les opérations qui utilisent les nouvelles colonnes/tables échouent fermées au lieu de contourner les contrôles.

Procédure de mise en service à préparer séparément :

La préparation ciblée est désormais décrite dans
[la procédure d’activation](financial-activation-runbook.md), avec précontrôles en lecture
seule, script de permissions distinct et preuves sur PostgreSQL jetable. Cela ne signifie
pas qu’une base réelle a été inspectée ou modifiée.

1. Confirmer la cible, le schéma réel, la sauvegarde/restauration et le rôle de migration.
2. Prévoir une fenêtre de maintenance des fonctions concernées et l'ordre migration puis serveur.
3. Appliquer uniquement la nouvelle migration après autorisation explicite ; ne pas lancer de synchronisation globale Drizzle contre les données réelles.
4. Vérifier les contraintes, triggers et droits du rôle applicatif sans modifier de données financières.
5. Retirer UPDATE/DELETE/TRUNCATE sur ledger/audit au rôle applicatif ; ne pas lui confier de droits propriétaire, superutilisateur ou de désactivation des triggers.
6. Garder les transferts et l'administration fermés jusqu'aux vérifications métier requises.

Les droits de la base réelle n'ont pas été inspectés ni modifiés. Un propriétaire/superutilisateur PostgreSQL peut désactiver des triggers : ce lot ne remplace pas le moindre privilège ni la surveillance des accès DBA. Il ne crée pas de RLS Supabase.

## Vérifications réellement exécutées

| Vérification | Résultat |
|---|---|
| Régénération OpenAPI puis typecheck de tout le monorepo | Réussis |
| Tests API, politiques, services et frontières SQL | 79/79 |
| Tests HTTP/SQL d'intégration sur PostgreSQL jetable | 10/10 |
| Simulations de concurrence existantes, distinctes des tests SQL | 3/3 |
| Contrôle des secrets sur fichiers texte du projet | 593 fichiers, 0 détection lors du contrôle |
| Audit de dépendances | 0 vulnérabilité remontée |
| Analyse statique SAST | 0 résultat, scan non incomplet |
| Analyse HoundDog | 0 vulnérabilité remontée |
| Redémarrage API et frontend | Réussis, services en fonctionnement |
| Requête locale `GET /api/healthz` | `{"status":"ok"}` |
| Capture de la page publique | Interface présente, pas d'erreur console observée |

La capture ne vérifie pas les pages authentifiées. Aucun test navigateur connecté n'a été lancé.

### Preuves des dix tests d'intégration

Le runner crée un cluster PostgreSQL temporaire sur socket Unix privé, sans écoute TCP. Il exporte le schéma, simule l'ancien schéma, applique deux fois la nouvelle migration, crée un rôle applicatif limité, puis lance l'API et les services réels avec des données synthétiques. L'environnement enfant est explicitement construit sans les secrets réels. Les appels externes via `fetch` y sont interdits. Le cluster est supprimé après les essais.

1. API privée sans session : 401 ; transaction propre accessible ; transaction d'autrui : 404.
2. Faux indicateur administrateur et statut de paiement fourni par le client sans effet.
3. Devis direct : frais falsifiés ignorés, plafond 409, PIN verrouillé 403, quota HTTP 429, aucune transaction supplémentaire.
4. 40 débits simultanés avec le même solde attendu : un seul succès, 39 conflits, solde cohérent.
5. 40 rejeux d'une même clé : une seule écriture ; contenu modifié rejeté ; échec de l'audit provoquant le rollback du ledger et du solde.
6. Contraintes et triggers : solde négatif refusé ; modification, suppression et troncature du ledger/audit refusées, même par le propriétaire de test tant que les triggers sont actifs.
7. Ancien KYC approuvé puis vérification plus récente expirée : plafond non vérifié.
8. 90 consommations simultanées du quota : exactement 60 autorisées ; reprise après expiration.
9. Webhooks : signature invalide refusée ; expiration retirant le plafond ; doublon reconnu ; retry réhorodaté reconnu ; contenu contradictoire 409 ; ancienne approbation sans effet ; décision réellement plus récente et retrait AML pris en compte.
10. Erreur de validation HTTP : pas d'identifiants internes BDD, de noms de secrets ni de stack dans la réponse testée.

Commandes reproductibles sans données réelles :

```sh
pnpm --filter @workspace/api-server run test:finance:isolated
env -i PATH="$PATH" HOME="$HOME" bash -c \
  'cd artifacts/api-server && node --experimental-strip-types --test src/lib/*.test.mjs src/services/*.test.mjs'
pnpm --filter @workspace/api-server run test:wallet-integrity
pnpm run typecheck
pnpm run check:secrets
```

## Risques et limites restants

- **Bloquant avant activité financière réelle** : exécution Mobile Money, rapprochement, remboursements/annulations, réservation des plafonds et registre financier complet ne sont pas implémentés ou validés par ce lot. Un devis n'est pas une réservation de fonds ni un paiement.
- **Déploiement** : migration et permissions réelles restent à vérifier/appliquer avec accord ; le code testé localement n'équivaut pas à une base de production migrée.
- **KYC ambigu** : le blocage persistant, le rapprochement serveur idempotent et les signaux opérationnels sont préparés (voir ci-dessous). La migration et la planification en production ne sont pas activées. Aucun appel Didit réel n'a confirmé la configuration live.
- **KYC historique** : un ancien reçu sans empreinte ne prouve jamais l'égalité du contenu. Toute répétition ouvre donc un rapprochement avec blocage, même si le statut enregistré semble identique ; le contenu original ne peut pas être reconstitué.
- **Confidentialité** : les habilitations et durées des reçus sont définies ci-dessous ; leur mise en œuvre organisationnelle, la purge planifiée et les droits réels restent à activer séparément. Le chiffrement ne dispense pas de minimiser les données et de protéger/faire tourner les clés.
- **Interface conservée** : les anciens calculs d'affichage et valeurs de profil côté navigateur n'ont pas été supprimés. Ils ne doivent pas devenir des autorités serveur. Afficher strictement le devis reçu du serveur et retirer les valeurs de profil fictives reste un chantier frontend distinct déjà identifié.
- **Secrets** : 0 détection par les scanners n'est pas une preuve d'absence absolue. Historique Git complet, secrets révoqués/rotation, bundles de production et fichiers ignorés ne sont pas certifiés par ce contrôle de sources.
- **Tests** : données synthétiques, charge limitée et base locale ; pas de pentest Strix, de test live, de contrôle des sauvegardes réelles ou de qualification complète des permissions de production.

## Références Didit consultées

- https://docs.didit.me/integration/verification-statuses
- https://help.didit.me/verification-sessions/session-statuses
- https://docs.didit.me/integration/webhooks

La documentation API présente un cycle principal plus restrictif que le centre d'aide sur les réouvertures et retraits AML. La politique serveur tient compte des retraits, de l'horodatage signé des changements et refuse de restaurer un privilège à partir d'un ancien événement.

## Complément — rapprochement des événements d'identité ambigus

### Autorité, ordre et retrait du privilège

Documentation officielle relue le 22 octobre 2026 :

- [Webhooks : enveloppe, signatures et retries](https://docs.didit.me/integration/webhooks) :
  `created_at` numérique = modification du dossier ; `timestamp`/`X-Timestamp` =
  envoi, renouvelé à chaque tentative. Même `event_id` sur les retries. Deux retries
  seulement (environ 1 minute, puis 4 minutes plus tard), puis abandon. Les 409
  ne sont pas rejoués : le conflit doit être conservé et signalé localement.
- [Statuts, réouvertures et retraits AML](https://help.didit.me/verification-sessions/session-statuses) :
  `Approved` peut devenir `In Review`, `Declined` ou `Kyc Expired`.
- [Lecture serveur d'une décision](https://docs.didit.me/sessions-api/retrieve-session) :
  `GET https://verification.didit.me/v3/session/{sessionId}/decision/` authentifié
  par clé serveur. Son `created_at` ISO est la création de session, **pas**
  l'horodatage numérique de mise à jour porté par le webhook.

Un changement de statut à date égale, un événement antérieur, une transition
inattendue ou un identifiant réutilisé avec un autre contenu ouvre un dossier
persistant (`reconciliation_required`). Une approbation locale devient alors
`In Review` dans la même transaction : le plafond non vérifié s'applique immédiatement.
Un retrait AML correctement ordonné continue de s'appliquer sans attendre un opérateur.
Les événements reçus pendant le blocage restent chiffrés avec `status_applied=false`.
Un doublon exact, y compris un retry réhorodaté, ne crée pas de nouvelle génération.

La file est portée par les vérifications, sans stockage mémoire comme autorité.
La migration additive
`lib/db/migrations/2026-10-22-identity-reconciliation.sql` reprend aussi les anciens
reçus retenus. Elle est réexécutable, ne réouvre pas les reçus antérieurs à un
rapprochement résolu, et n'a été appliquée **que sur PostgreSQL jetable**.
Comme pour le lot précédent : migration autorisée avant déploiement du serveur,
pas de push Drizzle global ni d'activation depuis l'aperçu.

### Rapprochement serveur préparé, non lancé en production

Le service `artifacts/api-server/src/services/identity-reconciliation.ts` :

1. Lit la génération du dossier bloqué, puis consulte le fournisseur **hors**
   transaction SQL pour ne pas garder de verrou pendant l'appel réseau.
2. Vérifie session, `vendor_data`, workflow, environnement et statut exacts ; refuse
   une session métier KYB et une approbation dont `expires_at` est invalide ou passé.
   Il ne reçoit jamais une décision depuis le navigateur ou une route administrateur.
3. Prend le verrou SQL et refuse le résultat si un nouvel événement a changé la
   génération. Une panne, un 429, un timeout, un JSON invalide ou un mauvais rattachement
   laisse le blocage en place ; aucune approbation de secours.
4. Enregistre la réponse fournisseur chiffrée dans un reçu distinct
   `reconciliation.resolved`, puis applique le statut et ferme le dossier **dans la même
   transaction**. Les anciens reçus restent inchangés, notamment `status_applied=false`.
   Des exécutions concurrentes ne valident qu'une fois la même génération.
5. Pose une borne conservatrice à l'heure serveur du début de lecture (seconde
   supérieure, sans reculer la dernière borne). Un webhook antérieur à cette borne
   provoque un nouveau rapprochement ; le `created_at` ISO de la décision ne sert
   jamais à classer les événements. Le coût de cette prudence est un rapprochement
   supplémentaire possible pour un webhook retardé, pas un privilège injustifié.

Le client réseau est limité à l'origine HTTPS Didit fixe, GET, redirections
interdites et timeout 10 secondes. Il refuse tout appel hors production **avant**
la lecture des identifiants et avant `fetch`. L'injection du lecteur fournisseur
est une dépendance interne destinée aux fixtures ; aucune route ne l'expose.

Après `pnpm --filter @workspace/api-server run build`, les commandes préparées sont :

```sh
# Contrôle de file uniquement ; aucune requête Didit.
pnpm --filter @workspace/api-server run identity:monitor
# À exécuter exclusivement dans le serveur de production, après autorisation
# explicite des lectures fournisseur et vérification de la cible/base/droits.
pnpm --filter @workspace/api-server run identity:reconcile
```

Ces commandes ne migrent rien. Le rapprochement traite au plus 100 dossiers,
séquentiellement ; relancer après traitement si une file subsiste. Codes de sortie :
0 = rien en attente, 2 = file non vide ou lecture dépassée par un nouvel événement,
1 = échec. Le serveur web ne démarre jamais ce worker tout seul. Aucun appel live
n'a été effectué ici ; la configuration, les coûts et le workflow réels ne sont
pas considérés comme validés par les fixtures.

### Alerte et procédure d'exploitation

- Le webhook émet `IDENTITY_RECONCILIATION_REQUIRED` au niveau erreur après
  validation de la transaction. L'identifiant de corrélation est celui du dossier
  interne ; aucune identité, clé, décision, URL de document ou charge utile en clair.
  Les conflits d'identifiant émettent le même code et conservent le second corps
  chiffré sous une référence locale déterministe, sans remplacer le premier.
- Le contrôle de file réémet le signal avec un nombre borné (maximum 100, donc
  « 100 » signifie au moins 100) et l'ancienneté du premier dossier. Il permet de
  retrouver les alertes perdues après un crash ou une panne du collecteur de logs.
- Lors de la mise en service autorisée, planifier `identity:monitor` toutes les
  5 minutes et router ces codes vers l'astreinte conformité/exploitation. Alerter
  dès le premier dossier, accuser réception sous 15 minutes et escalader à la
  conformité si non résolu sous 1 heure. Regrouper par dossier/code pour limiter
  les répétitions ; ne jamais acquitter en modifiant le statut SQL.
- L'opérateur contrôle le dossier et la disponibilité du fournisseur puis autorise
  la lecture serveur. Un échec conserve la file et le plafond réduit. Un retrait
  fournisseur (`Declined`, `In Review`, expiration) clôt le rapprochement sans
  octroyer de privilège. En cas d'incident de signature, ne jamais journaliser
  le corps brut malgré la recommandation de débogage générique de Didit.

Aucun collecteur externe, ordonnanceur, canal de notification ou rôle réel n'a
été configuré par cette intervention.

### Habilitations et conservation des reçus

Politique opérationnelle à faire approuver par le responsable conformité/DPO
avant activation réelle ; ce n'est pas une affirmation de durée légale universelle.

| Habilitation | Accès autorisé |
|---|---|
| Client, viewer, support courant, administrateur web | Aucun accès aux reçus ni au rapprochement ; aucune nouvelle page/route |
| Astreinte exploitation | Métadonnées de file et codes d'erreur uniquement ; peut lancer le worker après autorisation, jamais fixer un statut |
| Service API/worker | Chiffrement des preuves, rattachement serveur, transactions de statut ; clé fournisseur côté serveur exclusivement |
| Conformité habilitée | Déchiffrement ponctuel sur dossier justifié, accès nominatif temporaire et consultation auditée hors logs HTTP |
| DBA/migration | Migration ciblée autorisée ; pas d'usage courant de superutilisateur, pas d'accès ordinaire à la clé de déchiffrement |
| Service de rétention séparé | Effacement des corps arrivés à échéance uniquement, jamais modification du statut KYC |

Les droits SQL minimum à préparer sont SELECT/INSERT et UPDATE des seules colonnes
de traitement des reçus pour l'API ; aucun DELETE/TRUNCATE pour l'API ou le worker.
Sur les vérifications, UPDATE des colonnes de statut, génération et dates est
nécessaire. Le moniteur doit utiliser un rôle limité aux métadonnées de file,
sans SELECT sur les corps chiffrés. Le rôle de rétention peut mettre à NULL les
corps arrivés à échéance, sans changer empreinte, résultat ou statut de vérification.
Ces droits de production ne sont pas inspectés/appliqués ici ; des grants globaux
existants ou l'accès aux secrets par un propriétaire ne constituent pas une
séparation effective. Faire contrôler aussi les appartenances et privilèges hérités.

Durées retenues pour les **reçus techniques**, distincts du dossier KYC réglementaire :

- Corps de webhook et snapshots de décision chiffrés : **30 jours** après réception,
  ou 30 jours après la dernière résolution pour un dossier rapproché, selon la date
  la plus tardive.
- Dossier non résolu : revue conformité obligatoire à J+30, corps conservé au plus
  **90 jours** depuis réception. À J+90, purge du corps, maintien du blocage et de
  l'alerte ; ne jamais supprimer la file ni restaurer l'approbation pour purger.
- Gel juridique : prolongation uniquement par décision conformité documentée,
  motif, habilité et échéance de réexamen explicites ; revue tous les 30 jours.
- Métadonnées minimales d'idempotence (référence, empreinte, rattachement, résultat,
  dates) : pendant la vie de la session puis **90 jours** après sa clôture effective.
  Elles ne doivent jamais être supprimées tant que cette session peut conférer
  un privilège. La borne d'ordre et l'état bloqué survivent à la purge des corps.
- Journaux d'alerte sans corps ni identité : **90 jours**. Les sauvegardes doivent
  expirer sous **90 jours** et toute restauration doit réappliquer les échéances
  avant remise en service. Ne pas copier les corps vers des exports ou tickets.

La purge planifiée et le registre de gels juridiques ne sont **pas implémentés
ni exécutés** ici : la demande définit leur politique, elle n'autorise aucune
suppression réelle. Le chiffrement AES-GCM existant et les empreintes HMAC sont
conservés ; pas de corps, clé ou donnée personnelle en clair dans les alertes.

### Vérification de ce complément

- Tests HTTP avec fixtures HMAC-V2 et PostgreSQL jetable : conflits à la même
  seconde, ancien événement, refus d'une approbation pendant le blocage, retries
  concurrents sans nouvelle génération, conservation chiffrée des deux conflits.
- Décisions serveur synthétiques : mauvais compte/session/workflow/environnement,
  statut inconnu, expiration invalide/passée et timeout refusés ; le vrai lecteur
  bloque avant réseau en développement.
- Concurrence : un événement pendant la lecture invalide le snapshot ; six
  rapprochements simultanés ne produisent qu'une résolution ; l'échec d'insertion
  de la preuve annule aussi le changement de privilège.
- Migration testée deux fois au démarrage du cluster jetable et réexécutée après
  résolution, sans réouverture indue d'un ancien reçu.
- Le contrôle TypeScript API et bibliothèques passe. Le contrôle monorepo est
  bloqué hors périmètre dans `artifacts/sendflow/vite.config.ts` (TS7016/TS2769) ;
  aucun fichier frontend n'a été modifié pour contourner ce défaut.
- Reçus historiques : une approbation sans empreinte suivie d'un retrait signé
  sous le même identifiant provoque HTTP 409, conserve le retrait chiffré et
  réduit le plafond jusqu'à rapprochement serveur ; statut historique NULL
  également testé, retry sans nouvelle génération et décision finale défavorable.
- Résultats du complément : **22/22** intégrations isolées et **19/19** tests
  Didit/politique fournisseur ; contrôle de secrets : **646 fichiers texte,
  aucune détection**. Build et redémarrage API réussis ; `/api/healthz` répond
  `{"status":"ok"}` par requête et dans la capture. Les services frontend étant
  arrêtés, cette capture JSON ne constitue pas une validation des pages.
