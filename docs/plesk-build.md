# Build Plesk — SendFlow

## Périmètre

Cette procédure construit les packages localement avant le Push et vérifie leur
présence dans l'action post-Pull Plesk. Elle ne connecte pas GitHub à Plesk, ne démarre
pas les applications de production et n'exécute aucune migration, aucun SMS ni paiement.
Les pages et le code métier restent inchangés.

Le projet utilise pnpm et deux services Node : site React/Vite et API Express.
Le serveur du site applique la défense IP avant les fichiers publics : un dépôt de
fichiers statiques seul ne remplace pas ce service.

## Domaines publics de production

- Site principal SendFlow : `https://sendflow.africa`
- Application marchande et API : `https://merchent.business.sendflow.africa`,
  avec l'API sous `https://merchent.business.sendflow.africa/api`
- Documentation : `https://apis.docs.sendflow.africa`
- Paiement hébergé et liens LinkFlow : `https://payin.merchant.command.sendflow.africa`

L'application et les exemples utilisent des origines distinctes : `SENDFLOW_API_BASE_URL`
doit viser l'URL API sur le domaine marchand, tandis que `SENDFLOW_CHECKOUT_ORIGIN`
doit viser le sous-domaine `payin`. Le domaine principal sert les liens SendFlow publics
et ne remplace ni l'API ni la page de paiement. DNS, certificats HTTPS et routage Plesk
doivent être vérifiés séparément sur le serveur.

## Construction reproductible

Le workflow GitHub Actions `.github/workflows/plesk-build.yml` construit et publie les
artefacts lorsqu'un push accepté arrive sur `main`. Il utilise Node.js `24.22.2` et
pnpm `10.26.1`, installe le lockfile sans le modifier, exécute `pnpm run build:plesk`,
puis ajoute uniquement les packages Plesk au dépôt. Le commit d'artefacts est ensuite
disponible au Pull Git Plesk. Le workflow vérifie que `main` n'a pas avancé pendant le
build et échoue plutôt que de publier un paquet obsolète.

Le build peut aussi être lancé manuellement depuis la racine du dépôt, avec les mêmes
versions :

```sh
pnpm install --frozen-lockfile
pnpm run build:plesk
```

Le réglage `manage-package-manager-versions=true` dans `.npmrc` demande à pnpm
d'utiliser cette version déclarée.

Installer les dépendances de développement dans l'environnement de build. Le dépôt
autorise explicitement les quatre scripts nécessaires (`@swc/core`, `esbuild`, `msw` et
`unrs-resolver`) dans `pnpm-workspace.yaml`, avec les syntaxes `allowBuilds` et
`onlyBuiltDependencies` pour la compatibilité pnpm. Ne pas approuver globalement les
scripts de toutes les dépendances. Ne pas remplacer pnpm par npm, ne pas régénérer le
lockfile et ne pas lancer d'installation de dépendances ou de migration dans le hook
Plesk. Celui-ci vérifie seulement les packages déjà livrés par Git.

La commande impose `NODE_ENV=production` et `BASE_PATH=/` seulement aux processus de
compilation ; elle ne modifie aucune variable enregistrée. Les variables publiques
de routage Vite doivent viser les bonnes origines avant compilation. Aucune clé privée
ne doit être placée dans `VITE_*`. Aucun domaine Plesk n'est supposé par la commande.

Le build contrôle les secrets du source, le typage, les tests du conditionnement,
puis compile uniquement API et SendFlow (pas le mockup-sandbox). Il construit aussi
une archive Linux x64 des dépendances de production encore externes au bundle API
(notamment le module natif `sharp`). Il génère :

| Service | Racine de distribution relative au dépôt | Startup Plesk |
| ------- | ---------------------------------------- | ------------- |
| Site    | `dist`                                   | `index.cjs`   |
| API     | `artifacts/api-server/dist`              | `index.cjs`   |

Les adaptateurs CommonJS importent les bundles ESM existants et exigent
`NODE_ENV=production`. La logique n'est pas dupliquée. Chaque distribution contient
un manifeste privé `plesk-manifest.json` avec version du constructeur, empreinte du
lockfile, révision source, état des fichiers suivis et empreintes SHA-256 des fichiers.
Le manifeste ne contient aucune variable secrète. Les packages Plesk
`dist` et `artifacts/api-server/dist` sont explicitement suivis par Git afin que le Pull
les récupère avec le code. Le build génère aussi un `index.cjs` à la racine du dépôt
pour le réglage de démarrage Plesk. La sortie native Vite
`artifacts/sendflow/dist` reste ignorée et n'est pas nécessaire à l'exécution Plesk.
Le build versionne également `artifacts/api-server/plesk-runtime-dependencies.tar.gz`.
Cette archive contient les dépendances de production nécessaires à l'API dans un
format compressé ; aucun répertoire `node_modules` n'est ajouté à Git.

## Pull et validation Plesk

Le flux prévu est le suivant : pousser le code source sur `main`, laisser GitHub Actions
construire et publier les packages de production dans un commit sur `main`, puis laisser
Plesk récupérer ce commit. Les fichiers compilés et l'archive runtime sont dans Git ; le
serveur n'a pas à compiler les sources ni installer les paquets depuis le registre après
le Pull. Aucun workflow GitHub ne se connecte en SSH au serveur et aucun secret SSH
n'est requis.

Le workflow possède uniquement la permission `contents: write` nécessaire à ce commit.
Il ne lit aucun secret applicatif. Les événements Pull Request construisent et vérifient
le package sans le publier. Tous les pushes sur `main`, y compris la suppression d'un
artefact, déclenchent le build afin que les lanceurs manquants soient recréés. Les pushes
générés par `GITHUB_TOKEN` ne relancent pas les workflows, ce qui évite une boucle.
Une règle de protection de branche qui interdit les pushes du `github-actions[bot]`
fera échouer explicitement l'étape de publication et devra être compatible avec ce flux.

Dans les paramètres du dépôt Git Plesk, l'auto-déploiement doit être activé et cette
commande configurée comme action après le Pull, depuis le checkout SendFlow :

```sh
bash scripts/plesk/build-after-pull.sh
```

Le script retrouve le checkout avec Bash et vérifie les fichiers compilés livrés par
Git. Il n'appelle ni Git, ni `dirname`, ni Node, ni pnpm : le hook reste utilisable dans
l'environnement restreint de déploiement Plesk. Il exige `tar`, `gzip` et les utilitaires
de fichiers usuels, puis extrait l'archive runtime vers `artifacts/api-server/node_modules`
(répertoire ignoré par Git) avant le démarrage. Il n'exécute ni compilation ni installation
depuis un registre. Il échoue clairement si un fichier ou un outil manque. Le build GitHub
Actions est exécuté sous Node.js `24.22.2` avant le commit d'artefacts.

Configurer les racines et fichiers de démarrage des applications Node Plesk :

| Service | Application root relative au checkout | Fichier de démarrage relatif à cette racine |
| ------- | ------------------------------------- | ------------------------------------------- |
| Site    | `.`                                   | `index.cjs`                                 |
| API     | `artifacts/api-server`                | `dist/index.cjs`                            |

Dans les paramètres Node.js Plesk de **chaque application** (site et API),
vérifier que le processus reçoit `PORT`. Le code écoute exclusivement sur cette
valeur et ne choisit aucun port de secours. Si Plesk affiche un port d'application
attribué, l'entrée `PORT` des variables d'environnement doit reprendre exactement
cette valeur pour cette application ; ne pas inventer un numéro ni partager le port
entre les deux applications. Si Plesk/Passenger est censé injecter `PORT` mais que
les journaux indiquent qu'il est absent, corriger l'environnement de l'application
dans Plesk ou demander à l'hébergeur le port interne attribué avant le redémarrage.
Les variables Plesk ne sont pas versionnées dans ce dépôt.

Le paquet est déjà construit avant le Pull. Ne lancez pas `npm install`, `npm ci` ou
`npm update` dans la racine Plesk : le dépôt impose pnpm pour les builds et le hook
`scripts/plesk/build-after-pull.sh` active les dépendances API déjà empaquetées.
Une installation npm échouée n'est pas une réparation du paquet et ne fournit pas
le `PORT` manquant.

Pour le site, choisir `dist/public` comme Document Root relatif au checkout.
L'application doit tout de même router les requêtes vers Node : le serveur applique le
contrôle IP avant de servir chaque fichier. Il ne faut pas laisser Apache/Nginx servir
directement les fichiers statiques avant le passage par Node.
Pour l'API, choisir le Document Root privé vide
`artifacts/api-server/plesk-empty-document-root`, qui doit rester à l’intérieur de sa
racine d’application. Ne jamais choisir `dist` au complet,
`artifacts` ou `artifacts/api-server` : ils contiennent également des bundles serveur
et des manifestes.
Le domaine `apis.docs.sendflow.africa` sert la page documentaire dans le processus
site (`index.cjs`). Le domaine `payin.merchant.command.sendflow.africa` sert les routes
de paiement `/pay/:token` du même site ; les liens LinkFlow et les intégrations Hosted
Checkout doivent utiliser cette origine en production. L'application limite ce domaine
aux routes publiques de paiement. Pour chacun de ces domaines, router les pages vers le
service site et `/api` vers le service API, en conservant les chemins. Le sélecteur
d'hôte ne décide d'aucune autorisation ou règle financière.

Le dossier `dist/public` contient uniquement l'application publique. L'interface privée
est construite séparément dans `dist/admin`, hors du Document Root. Le serveur Node ne
sert cette interface qu'après validation serveur du chemin et du jeton d'accès, puis pose
un cookie de garde sécurisé. Le même cookie est exigé par l'API avant la vérification de
la session Super Admin. L'authentification e-mail, mot de passe et TOTP reste obligatoire.
Le `index.cjs` racine importe `dist/server/index.mjs`; le serveur Plesk démarre les deux
processus Node nécessaires (site et API), chacun avec ses variables privées. Vérifier que
les fichiers ne sont pas servis directement par Apache avant le passage par Node.

## Correspondance avec le Document Root Plesk

Le build crée `dist/public`, `dist/admin`, un `index.cjs` à la racine pour démarrer le
serveur site, ainsi que la distribution API séparée. Les chemins absolus, les ports et
les comptes système Plesk restent à vérifier sur le serveur ; `dist/public` est le
Document Root, tandis que l'interface privée est servie par Node et ne doit pas être
exposée comme un répertoire statique Apache.

## Runtime et routage à confirmer sur Plesk

- La version Node du constructeur figure dans les manifestes. Le workflow de build
  exige Node.js 24.22.2 et pnpm 10.26.1. Le dernier runtime Plesk communiqué est
  Node.js 24.22.3 ; cet écart de correctif n'explique pas `INVALID_PORT`, mais la
  compatibilité de l'archive native doit être confirmée après redémarrage sur Plesk.
- L'archive des dépendances API est construite pour Linux x64/glibc (runner GitHub
  `ubuntu-latest`). La compatibilité exacte doit être confirmée avec l'architecture et
  la distribution système de l'hébergement Plesk ; aucun accès serveur ne permet de
  la certifier depuis ce dépôt.
- Vérifier la prise en charge du démarrage `index.cjs`/import ESM par le gestionnaire
  de processus Plesk. Un test local d'adaptateur ne certifie pas Passenger.
- Le proxy HTTPS doit router `/api` et `/api/...` vers l'API, en conservant le chemin ;
  le reste doit atteindre le serveur Node du site. Chaque service écoute son propre `PORT`.
- Injecter `ADMIN_SECRET_PATH` et `ADMIN_SECRET_TOKEN` dans les paramètres secrets des
  deux processus Node (site et API). Les Secrets Replit ne sont pas transférés par le
  paquet Plesk. Le jeton n'est jamais inclus dans l'URL; le formulaire le transmet par
  HTTPS dans le corps d'une requête et l'application ne le journalise pas.
- Les cookies de garde et de session sont sécurisés et limités au même hôte. L'API doit
  rester accessible sous la même origine HTTPS que l'interface, via le préfixe `/api`.
- Les journaux d'accès du proxy ou d'Apache peuvent enregistrer les chemins demandés.
  Avant d'utiliser un chemin confidentiel en production, vérifier que la configuration
  Plesk/Apache n'en conserve pas la valeur en clair; ce dépôt ne configure pas ces journaux.
- Les API inconnues doivent rester des erreurs API, pas du HTML de la SPA. Un fichier
  JS/CSS absent doit rester un 404 ; les routes SPA valides doivent accepter un refresh.
- Définir séparément dans l'environnement privé de **chacune des deux applications
  Node (site et API)** : `NODE_ENV=production`,
  `SENDFLOW_DATABASE_TARGET=production`, `SUPABASE_DATABASE_URL`,
  `DATABASE_CA_CERT` et `TRUST_PROXY_HOPS`. Le serveur du site utilise lui aussi
  Supabase pour son contrôle IP avant de servir les pages et les fichiers ; ces variables
  ne sont donc pas réservées à l'API. Les variables Plesk ne sont pas partagées
  automatiquement entre les deux applications.
  `DATABASE_URL` reste accepté comme nom de compatibilité uniquement s’il pointe vers
  la même base Supabase; si les deux sont définis, `SUPABASE_DATABASE_URL` est prioritaire.
  La connexion vérifie le certificat TLS et le nom d’hôte. Les secrets Replit ne sont
  pas transférés par ce build.
- Si un démarrage échoue, le lanceur consigne une catégorie d'erreur et uniquement les
  noms des variables obligatoires absentes pour le service concerné ; il ne consigne
  aucune valeur de variable. Les erreurs HTTP 500/504 sur `/api` sont à diagnostiquer
  dans les journaux Node de l'application API, distincts de ceux du site.
- Configurer `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` dans l'environnement privé
  du service Node API Plesk. La première est la clé publique du widget; l'API la fournit
  à l'interface au runtime par `GET /api/auth/turnstile-config`. Elle n'est donc pas
  intégrée au paquet de build. La seconde est la clé privée Siteverify et ne doit jamais
  être renvoyée par une API, utilisée dans une variable `VITE_*`, ou copiée dans le site,
  le dépôt Git ou un bundle client.
- Configurer `CORS_ALLOWED_ORIGINS` dans l'environnement privé de l'API avec les
  origines HTTPS exactes. `TRUST_PROXY_HOPS` doit être configuré dans les deux
  applications selon la chaîne de proxys réellement observée ; ne pas deviner sa valeur.
  Ne pas reprendre les variables de prévisualisation Replit.
  Autoriser les origines exactes qui appellent l'API depuis le navigateur, notamment
  `https://sendflow.africa`,
  `https://merchent.business.sendflow.africa`,
  `https://apis.docs.sendflow.africa` et
  `https://payin.merchant.command.sendflow.africa` si ces interfaces utilisent l'API.
- Préserver la vérification TLS de PostgreSQL, les sessions sécurisées, les contrôles OTP/PIN,
  les rôles et les protections financières. Ce build n'autorise aucun paiement.
- Le Document Root du site est `dist/public` ; `dist/admin`, le bundle serveur, les
  `.map`, le manifeste et les fichiers de configuration ne doivent pas être exposés par
  Apache. Les requêtes doivent passer par Node afin que le contrôle IP et la sélection
  de bundle s'appliquent. Cloudflare Access, TLS et le pare-feu doivent être configurés
  et testés sur l'hébergement ; ce build ne les active pas.
- L'API n'a aucun fichier public à exposer ; utiliser
  `artifacts/api-server/plesk-empty-document-root`, répertoire vide privé placé sous la
  racine Node de l'API, si Plesk exige un Document Root pour cette application.

## Livraison, vérification et retour arrière

1. Conserver la release précédente, son manifeste et sa configuration privée ; confirmer
   une sauvegarde/restauration de la base configurée avant toute évolution nécessitant une migration.
2. Construire dans une nouvelle release et vérifier les manifestes et droits de lecture.
   Ne pas employer `chmod 777` ni remplacer les propriétaires sans vérifier les comptes.
3. Vérifier DNS, certificat et chaîne proxy avant redirection HTTPS et bascule.
4. Après autorisation de déploiement : démarrer les deux services et vérifier les logs,
   les pages publiques, les assets, les routes imbriquées, les erreurs API et la santé.
   Vérifier séparément les sessions avec un compte autorisé, sans paiement réel.
5. En cas d'échec, rétablir la release et la configuration précédentes, redémarrer les
   deux services et recontrôler les mêmes chemins. Ne pas restaurer ou modifier la base
   automatiquement pour un retour de code ; la compatibilité des schémas est distincte.

Sans accès authentifié à Plesk, DNS/proxy/SSL/runtime/production restent à vérifier.
Un succès de compilation n'est pas une validation de l'exploitation financière.
