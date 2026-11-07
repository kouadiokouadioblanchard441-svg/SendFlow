# Build Plesk — SendFlow

## Périmètre

Cette procédure construit les packages localement avant le Push et vérifie leur
présence dans l'action post-Pull Plesk. Elle ne connecte pas GitHub à Plesk, ne démarre
pas les applications de production et n'exécute aucune migration, aucun SMS ni paiement.
Les pages et le code métier restent inchangés.

Le projet utilise pnpm et deux services Node : site React/Vite et API Express.
Le serveur du site applique la défense IP avant les fichiers publics : un dépôt de
fichiers statiques seul ne remplace pas ce service.

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
le package sans le publier. Les chemins d'artefacts sont exclus du déclenchement pour
éviter une boucle ; les pushes générés par `GITHUB_TOKEN` ne relancent pas les workflows.
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

Pour le site, choisir `dist/public` comme Document Root (relatif au checkout), ce qui
correspond à `/merchent.business.sendflow.africa/dist/public` quand le checkout est à
la racine du domaine. L'application doit tout de même router les requêtes vers Node :
le serveur applique le contrôle IP avant de servir chaque fichier. Il ne faut pas
laisser Apache/Nginx servir directement des fichiers de `dist/public` avant ce contrôle.
Pour l'API, choisir le Document Root privé vide
`artifacts/plesk-empty-document-root`. Ne jamais choisir `dist` au complet,
`artifacts` ou `artifacts/api-server` : ils contiennent également des bundles serveur
et des manifestes.
Le domaine `apis.docs.sendflow.africa` sert la page documentaire dans le processus
site (`index.cjs`). Le domaine `payin.merchant.command.sendflow.africa` sert les routes
de paiement `/pay/:token` du même site ; les liens LinkFlow et les intégrations Hosted
Checkout doivent utiliser cette origine en production. L'application limite ce domaine
aux routes publiques de paiement. Pour chacun de ces domaines, router les pages vers le
service site et `/api` vers le service API, en conservant les chemins. Le sélecteur
d'hôte ne décide d'aucune autorisation ou règle financière.

Le dossier `dist/public` contient uniquement le site public. Le `index.cjs` racine est
un adaptateur généré qui importe `dist/server/index.mjs`, lequel sert ce contenu après
le contrôle IP. Le serveur Plesk doit démarrer les deux processus Node nécessaires
(site et API), chacun avec ses variables privées. Vérifier dans Plesk que les fichiers
statiques ne sont pas servis directement avant le passage par Node.

## Correspondance avec le Document Root Plesk

Le build crée le dossier racine `dist/public` demandé pour le Document Root,
un `index.cjs` à la racine pour démarrer le serveur site, ainsi que la distribution API
séparée. Les chemins absolus, les ports et les comptes système Plesk restent à vérifier
sur le serveur ; le chemin relatif `dist/public` est celui à utiliser depuis le checkout.

## Runtime et routage à confirmer sur Plesk

- La version Node du constructeur figure dans les manifestes. Le workflow de build
  exige Node.js 24.22.2 et pnpm 10.26.1. Le runtime Plesk doit aussi utiliser Node.js
  24.22.2 ; le runtime réel reste à confirmer sur le serveur. Le fonctionnement sous
  une autre version, dont Node 22.23.3, n’est pas démontré.
- L'archive des dépendances API est construite pour Linux x64/glibc (runner GitHub
  `ubuntu-latest`). La compatibilité exacte doit être confirmée avec l'architecture et
  la distribution système de l'hébergement Plesk ; aucun accès serveur ne permet de
  la certifier depuis ce dépôt.
- Vérifier la prise en charge du démarrage `index.cjs`/import ESM par le gestionnaire
  de processus Plesk. Un test local d'adaptateur ne certifie pas Passenger.
- Le proxy HTTPS doit router `/api` et `/api/...` vers l'API, en conservant le chemin ;
  le reste doit atteindre le serveur Node du site. Chaque service écoute son propre `PORT`.
- Définir `SENDFLOW_INTERNAL_API_ORIGIN` dans l'environnement privé du service site,
  vers l'origine HTTP(S) interne de l'API, par exemple `http://127.0.0.1:<API_PORT>`.
  Le serveur du site l'utilise pour vérifier la session avant de servir la route protégée.
  Ne pas l'exposer en `VITE_*` ni le déduire de l'en-tête Host. Si l'origine manque ou
  si l'API est indisponible, cette route échoue fermée avec HTTP 503.
- Les API inconnues doivent rester des erreurs API, pas du HTML de la SPA. Un fichier
  JS/CSS absent doit rester un 404 ; les routes SPA valides doivent accepter un refresh.
- Définir `NODE_ENV=production`, `SENDFLOW_DATABASE_TARGET=production`,
  les secrets serveur nécessaires et `DATABASE_URL` dans l'environnement
  privé Plesk. Les secrets Replit ne sont pas transférés par ce build.
- Configurer `TRUST_PROXY_HOPS` selon la chaîne réellement observée, et
  `CORS_ALLOWED_ORIGINS` avec les origines HTTPS exactes. Ne pas reprendre les
  variables de prévisualisation Replit.
  Ajouter `https://payin.merchant.command.sendflow.africa` aux origines autorisées
  si les appels navigateur à l'API sont envoyés depuis cette page de paiement.
- Préserver la vérification TLS de PostgreSQL, les sessions sécurisées, les contrôles OTP/PIN,
  les rôles et les protections financières. Ce build n'autorise aucun paiement.
- Le Document Root du site est `dist/public` ; il ne doit pas exposer le bundle serveur,
  les `.map`, le manifeste ou des fichiers de configuration. Les requêtes vers ces
  fichiers doivent toujours passer par le serveur Node afin que le contrôle IP s'exécute.
- L'API n'a aucun fichier public à exposer ; utiliser le répertoire vide privé si Plesk
  exige un Document Root pour cette application.

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
