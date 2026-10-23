# SendFlow — audit et sécurisation des routes

Date : 23 octobre 2026. Périmètre : code présent dans ce workspace, API Express,
serveur de fichiers SendFlow et tests PostgreSQL jetables.

## Conclusion

Les protections des **74 déclarations de routes API** ont été inventoriées,
revues et exercées par requêtes HTTP dans un environnement isolé.
Les lacunes de contrôle d'origine, de centralisation administrative et de
traitement des fichiers publics décrites ci-dessous ont été corrigées.

Cela ne constitue **ni une garantie d'absence de failles**, ni un pentest
Strix, ni une certification de Plesk ou des paiements réels.
Les trois scanners exécutés n'ont émis aucun signalement.

**Aucune page, aucun style, aucune donnée de production, aucune variable
d'environnement persistante ni aucun réglage Plesk n'a été modifié.**
Aucune requête à un prestataire réel, aucun SMS, aucun paiement ni déploiement
n'a été effectué pendant les tests.

## Cartographie et visites

| Surface | Nombre | Vérification |
| --- | ---: | --- |
| Lectures publiques | 8 | Pays, inscription, tarifs, bannières, santé API/BDD, logo et stockage public |
| Authentification/récupération client | 8 | Origines absentes/étrangères refusées ; corps vides rejetés ; déconnexion idempotente |
| Session et données client | 11 | Accès anonyme refusé, dont session, compte, profil, historique, détail, PIN, devis et identité |
| Administration | 46 | Accès anonyme, contrôles d'origine ; routes d'accès volontairement distinctes des fonctions protégées |
| Webhook | 1 | Didit : signature absente refusée sans nouvelle preuve en BDD |
| Chemins front | 25 | Visites HTTP des chemins extraits de `App.tsx`, via le serveur statique réel et une page SPA de fixture |

Les 25 visites front prouvent le routage HTTP et les restrictions du serveur
statique, **pas le rendu React, les interactions ou chaque état connecté
dans un navigateur**. Aucun test navigateur authentifié n'a été lancé.
Les routes dynamiques ont été exercées avec des identifiants synthétiques.
Les requêtes GET impliquent également le traitement HEAD natif d'Express ;
chaque combinaison de query string, encodage et méthode non déclarée n'a pas
été explorée exhaustivement.

L'inventaire exact (méthode, chemin, catégorie, fichier et ligne) se régénère
depuis les déclarations TypeScript, sans liste manuelle parallèle :

```sh
node --input-type=module -e \
 'import {routeInventory} from "./artifacts/api-server/tests/security/route-inventory.mjs"; console.table(routeInventory())'
```

Les routes d'accès administrateur `/access`, `/sign-in`, `/pin/unlock` et
`/sign-out` restent en dehors du groupe métier protégé, mais conservent leurs
contrôles propres. Le préfixe administratif n'est pas considéré comme un secret
ou une protection d'accès.

## Constats et corrections

### 1. Moyen — contrôle d'origine client non uniforme

**Preuve de code :** avant correction, `account.ts` acceptait le PATCH du profil
et `transfer-quote.ts` le POST des devis sans vérification locale d'Origin.
Les autres mutations client avaient des contrôles dispersés. Les cookies client
sont `HttpOnly`, `Secure`, avec `SameSite=None` pour l'aperçu intégré.
CORS seul ne refuse pas l'exécution de toutes les requêtes simples.

**Risque :** des appels inter-origines pouvaient atteindre certaines validations
et consommer des ressources/quota. Aucun vol de compte ou changement de profil
inter-origines n'a été exploité avant correction ; PATCH exige normalement un
précontrôle CORS côté navigateur.

**Correction :** `src/lib/api-request-security.ts`, monté dans `src/app.ts` avant
le parsing et les sessions, impose une origine explicitement autorisée à toute
méthode non sûre de l'API. Les erreurs sont non mises en cache. Seul le POST
exact `/webhooks/didit` est exempté du contrôle navigateur ; il reste soumis
à sa signature et à ses contrôles d'événement.

**Tests :** origines absentes, opaques, étrangères et malformées ; corps JSON
invalide refusé avant parsing ; pas de consommation du quota de devis ;
faux chemins de webhook non exemptés.

### 2. Faible — contrôles administrateur uniquement distribués

**Preuve :** chaque route appelait son propre contrôle. Aucun contournement
d'accès administratif n'a été démontré, mais un oubli dans une nouvelle route
pouvait créer une régression.

**Correction :** `src/routes/index.ts` ajoute au groupe métier un contrôle
commun de session administrateur, portée actuelle, droit de mutation et PIN.
Les vérifications locales sont conservées.

**Tests :** appel direct de chaque route sans session ; jeton client et faux
en-tête de rôle refusés ; lecture catalogue autorisée avec session adéquate ;
PIN verrouillé et mutations interdites refusés dans le routeur complet.

**Important :** les droits existants restent limités au catalogue. Les écrans
financiers, utilisateurs, blocklist et réseau ne sont pas rendus accessibles
par ces seuls droits. Aucune élévation de privilèges n'a été ajoutée.

### 3. Moyen — retransmission sans sélection des en-têtes de stockage

**Preuve :** `src/routes/storage.ts` copiait tous les en-têtes de la réponse
stockage et acceptait le type de contenu sans politique de navigation.
L'appel de lecture n'avait pas de délai propre ni de refus des redirections.

**Risque conditionnel :** remplacement d'en-têtes protecteurs, contenu actif
dans l'origine applicative, attente prolongée. La possibilité pour un attaquant
de placer un tel objet/en-tête dans le stockage réel n'a pas été démontrée.

**Corrections :** sélection des en-têtes utiles ; cookies et politiques amont
non retransmis ; sandbox CSP ; images statiques conservées en affichage ;
HTML et autres types actifs traités en téléchargement ; origine HTTPS Google
Storage vérifiée ; redirections refusées ; lecture limitée à 15 secondes ;
erreurs du flux prises en charge, échec du service renvoyé sans détails internes.
Fichiers : `routes/storage.ts`, `lib/public-object-response-policy.ts`.

**Tests :** URL hostile, HTTP, identifiants URL et port inhabituel refusés ;
simulation complète de la signature et du téléchargement ; cookies injectés
supprimés et en-têtes de sécurité conservés. Le service de stockage réel n'a
pas été contacté. Sans configuration, la route renvoie volontairement 503.

**Risque de compatibilité :** un usage futur du stockage pour servir des
scripts, pages HTML actives ou des URL autres que Google Storage exige une
analyse distincte ; cette route publique ne les exécute plus.

### 4. Faible — normalisation trop permissive des origines entrantes

La configuration peut toujours utiliser un nom d'hôte, mais un en-tête Origin
entrant doit désormais comporter explicitement `http://` ou `https://`.
Les valeurs nues, relatives et `null` sont rejetées.
Fichiers : `lib/origin-policy.ts` et son test.

### 5. Faible — validation du PIN avant contrôle de session

`PUT /me/pin` valide maintenant la session avant de valider le corps.
Cela homogénéise le refus anonyme ; aucune fuite de PIN ou modification de PIN
sans session n'avait été démontrée.
Fichier : `routes/customer-auth.ts`.

## Tests effectivement exécutés — résultats finaux

| Commande / outil | Résultat |
| --- | --- |
| `test:routes:isolated` — politiques unitaires | 5 réussis |
| `test:routes:isolated` — HTTP et PostgreSQL jetable | 148 réussis |
| `test:auth` | 17 réussis |
| `test:security` | 40 réussis |
| `test:admin-access:isolated` | 10 réussis |
| `test:finance:isolated` | 35 réussis |
| `test:secret-boundaries` | 7 réussis, puis 3 tests de sûreté des logs réussis |
| `pnpm run typecheck` | Réussi |
| `pnpm run check:secrets` | 733 fichiers texte contrôlés au moment du contrôle, 0 signalement |
| Analyse des dépendances | 0 vulnérabilité signalée |
| SAST, rejoué après corrections runtime | Analyse terminée, 0 signalement |
| Analyse de circulation des données sensibles, rejouée | 0 signalement |

Les tests financiers couvrent notamment IDOR sur transactions, faux statuts et
rôles, limites et prix falsifiés, PIN verrouillé, SQL concurrent, idempotence,
annulation atomique sur échec d'audit, registre non modifiable, webhooks
répétés/expirés/désordonnés et isolation du compte de visualisation.

Deux anciens faux échecs de tests ont également été corrigés, sans diminuer
les protections : contrats de hash production/aperçu testés séparément ;
SQL réseau autorisé seulement dans sa frontière dédiée, avec texte SQL littéral
et nombre de paramètres vérifié par analyse syntaxique.
Les premiers passages du nouvel audit ont aussi révélé des hypothèses de
fixtures incorrectes (état initial de migration, statuts de refus et version
UUID des droits) ; les résultats du tableau sont ceux des derniers passages
réussis, pas des résultats supposés.

L'environnement PostgreSQL de test utilise un socket Unix privé, TCP désactivé,
des identifiants synthétiques et un environnement ne reprenant pas les secrets
réels. Les transports externes sont bloqués ou remplacés explicitement par
des réponses simulées. Le cluster est détruit en fin d'exécution.

## Compétences consultées et outils réellement utilisés

Les neuf skills installés ont été consultés pour leurs consignes :
`application-security-testing`, `find-security-vulnerabilities-in-code`,
`api-security-testing`, `web-app-penetration-testing`, `owasp-top-10-testing`,
`penetration-testing-with-strix`, `managed-pentesting-with-strix`,
`ci-security-scanning-with-strix`, `fix-security-vulnerabilities-with-strix`.

Leur moteur Strix n'est pas disponible dans le PATH : **aucun scan, achat,
téléversement cloud ni exploit Strix n'a été exécuté**. Les conseils applicables
ont servi au cadrage (autorisation, isolation, classement et preuves).
Les trois scanners intégrés, la revue de code et les tests HTTP/SQL ci-dessus
constituent les vérifications réellement réalisées. Aucun pipeline CI Strix
n'a été ajouté et aucun rapport Strix n'a été inventé.

## Risques résiduels et priorités

1. **Avant paiements réels :** le moteur financier complet FeexPay demeure
   non raccordé ; les paiements restent désactivés. Ce contrôle des routes ne
   remplace pas le règlement et le rapprochement serveur manquants.
2. **Avant production Plesk :** confirmer TLS, redirections, HSTS, configuration
   proxy, origines autorisées, permissions PostgreSQL effectives et refus des
   fichiers privés sur le véritable serveur. Aucun accès à cet hébergement
   n'a été utilisé ici.
3. **Politique du site HTML :** CSP et protection d'intégration des documents
   HTML à déployer progressivement, en vérifiant les scripts/styles et l'aperçu
   intégré. La CSP ajoutée ici concerne les objets publics, pas toutes les pages.
4. **Couverture :** pas d'exploration navigateur connectée de tous les états,
   pas de fuzzing exhaustif, pas de test de charge, pas d'audit cryptographique
   externe ni de vérification de tous les composants/historiques Git/binaires.
5. **Évolution des droits :** définir des permissions granulaires pour les
   fonctions hors catalogue avant de les ouvrir ; ne pas élargir une expression
   de chemin pour accorder tout le panel.
6. **Régressions futures :** exécuter automatiquement l'inventaire et les tests
   isolés sur chaque livraison. Une liste de routes testée aujourd'hui ne
   garantit pas les routes ajoutées demain.

## Retour arrière

Pas de migration ni de changement de données requis par ce lot. Ne pas retirer
le contrôle CSRF général ou les contrôles d'accès pour rétablir un client :
corriger son origine autorisée et sa configuration. Si une régression du flux
de stockage apparaît, isoler la modification concernée sans rétablir le
transfert de cookies ou de contenu actif. Pour un retour de version, conserver
les traces d'audit et rapprocher toute opération financière en cours.
