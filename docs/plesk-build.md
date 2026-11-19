# Build Plesk — SendFlow

## Périmètre

Cette procédure construit les packages localement avant le Push et vérifie leur
présence dans l'action post-Pull Plesk. Elle ne connecte pas GitHub à Plesk, ne démarre
pas les applications de production et n'exécute aucune migration, aucun SMS ni paiement.
Les pages et le code métier restent inchangés.

Le projet utilise pnpm et un seul processus Node sur le domaine marchand. Il sert le site
React/Vite et monte l'API Express sous `/api` dans le même serveur HTTP. Le serveur du site
applique la défense IP aux pages et fichiers publics ; l'API conserve ses propres
middlewares de sécurité, d'authentification et de contrôle IP.

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
artefacts lorsqu'un push accepté arrive sur `main`. Il utilise Node.js `24.22.3` et
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
puis compile l'API et SendFlow (pas le mockup-sandbox). Le bundle API est intégré au
package du site sous `dist/server/api/`. Une archive Linux x64 de ses dépendances de
production externes au bundle (dont les modules natifs utilisés par l'API) est livrée
dans `dist/plesk-runtime-dependencies.tar.gz`. Les workers Pino requis sont livrés dans
`dist/dist/` sous la racine de l'application Plesk, emplacement attendu par son résolveur
runtime. Le seul package Plesk est :

| Application | Racine Plesk | Document Root | Startup Plesk |
| ----------- | ------------ | ------------- | ------------- |
| Site + API  | `dist`       | `dist/public` | `index.cjs`   |

Le lanceur CommonJS `dist/index.cjs` importe le serveur ESM `dist/server/index.mjs`,
qui charge le bundle Express intégré. Le processus exige `NODE_ENV=production`.
`dist/plesk-manifest.json` contient la version du constructeur, l'empreinte du lockfile,
la révision source et les empreintes SHA-256 des fichiers ; il ne contient aucun secret.
Le package `dist` et le lanceur racine de compatibilité sont suivis par Git.
Le répertoire extrait `dist/node_modules` est ignoré par Git ; il est recréé après le Pull
à partir de l'archive fournie. La sortie native Vite `artifacts/sendflow/dist` reste
ignorée et n'est pas nécessaire à l'exécution Plesk.

## Pull et validation Plesk

Le flux prévu est le suivant : pousser le code source sur `main`, laisser GitHub Actions
construire et publier les packages de production dans un commit sur `main`, puis laisser
Plesk récupérer ce commit. Les fichiers compilés et l'archive runtime sont dans Git ; le
serveur n'a pas à compiler les sources ni installer les paquets depuis le registre après
le Pull. Aucun workflow GitHub ne se connecte en SSH au serveur et aucun secret SSH
n'est requis.

Le serveur Node unique reçoit les pages, les assets et toutes les requêtes `/api/*`.
Il délègue `/api` à Express dans le même processus et sur la même écoute Passenger ; le
front-end continue à appeler des chemins relatifs `/api` sur son origine habituelle.
Aucune règle de proxy Plesk supplémentaire ni aucun port upstream fixe ne doit être ajouté.
Les fichiers statiques doivent toujours passer par Node pour conserver les contrôles IP.

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

Cette action doit être configurée une seule fois dans les réglages du dépôt Git Plesk.
Après cette configuration, chaque Pull active automatiquement les dépendances avant
Restart App : aucune commande npm/pnpm n'est requise à chaque livraison. Si l'action
n'est pas configurée ou échoue, `dist/node_modules` reste absent et Node peut s'arrêter
avec `ERR_MODULE_NOT_FOUND` (le premier module runtime attendu par ce build est `argon2`).

Le script retrouve le checkout avec Bash et vérifie les fichiers compilés livrés par
Git. Il n'appelle ni Git, ni `dirname`, ni Node, ni pnpm : le hook reste utilisable dans
l'environnement restreint de déploiement Plesk. Il exige `tar`, `gzip` et les utilitaires
de fichiers usuels, puis extrait l'archive runtime vers `dist/node_modules` (répertoire
ignoré par Git) avant le démarrage. Il n'exécute ni compilation ni installation depuis
un registre. Il échoue clairement si un fichier ou un outil manque. Le build GitHub
Actions est exécuté sous Node.js `24.22.3` avant le commit d'artefacts.

Configurer les racines et fichiers de démarrage des applications Node Plesk :

| Réglage Plesk | Valeur/chemin attendu |
| ------------- | -------------------- |
| Application Root | `dist` |
| Document Root | `dist/public` |
| Application Startup File | `index.cjs` |

Cette disposition correspond à la capture Plesk. Dans `dist`, `index.cjs` charge
`server/index.mjs`; le Document Root `dist/public` reste sous la racine de l'application.
Le lanceur `index.cjs` à la racine du checkout est conservé pour compatibilité, mais
n'est pas le Startup File indiqué par le panneau.

Le serveur utilise `PORT` lorsqu'il est fourni. Si cette variable est absente ou invalide,
il appelle `listen(0, "0.0.0.0")` : le système attribue alors un port éphémère, sans port
fixe codé en dur. Cette voie suppose que Passenger intercepte l'appel à `listen()` comme
dans l'installation visée ; le dépôt seul ne peut pas certifier ce comportement sur le
serveur de production. Ne saisissez pas un port interne arbitraire dans le panneau. Les
ports publics HTTPS 443/HTTP 80 appartiennent au proxy web et sont distincts de l'écoute
interne Node.js.

Le paquet est déjà construit avant le Pull. Ne lancez pas `npm install`, `npm ci` ou
`npm update` dans la racine Plesk : le dépôt impose pnpm pour les builds et le hook
`scripts/plesk/build-after-pull.sh` active les dépendances API déjà empaquetées.
Une installation npm échouée ne répare pas le paquet et ne corrige pas un échec de
démarrage. Si le panneau propose pnpm, le sélectionner pour éviter les
commandes npm accidentelles ; dans tous les cas, ne pas installer depuis Plesk.

Pour le site, choisir `dist/public` comme Document Root relatif au checkout.
L'application doit tout de même router les requêtes vers Node : le serveur applique le
contrôle IP avant de servir chaque fichier. Il ne faut pas laisser Apache/Nginx servir
directement les fichiers statiques avant le passage par Node. Aucun second Node app, proxy
`/api` ni Document Root API séparé n'est nécessaire pour le domaine marchand.
Le domaine `apis.docs.sendflow.africa` sert la page documentaire et
`payin.merchant.command.sendflow.africa` sert les routes publiques `/pay/:token` lorsque
ces hôtes sont attachés à ce site. Le sélecteur d'hôte ne décide d'aucune autorisation ou
règle financière. Pour le domaine marchand, les pages et `/api` sont servis par le même
processus Passenger.

Le dossier `dist/public` contient uniquement l'application publique. L'interface privée
est construite séparément dans `dist/admin`, hors du Document Root. Le serveur Node ne
sert cette interface qu'après validation serveur du chemin et du jeton d'accès, puis pose
un cookie de garde sécurisé. Le même cookie est exigé par l'API avant la vérification de
la session Super Admin. L'authentification e-mail, mot de passe et TOTP reste obligatoire.
Le `index.cjs` racine importe `dist/server/index.mjs` pour compatibilité ; Plesk démarre
`dist/index.cjs`. Vérifier que les fichiers ne sont pas servis directement par Apache
avant le passage par Node.

## Correspondance avec le Document Root Plesk

Le build crée `dist/public`, `dist/admin`, `dist/server/api/embedded.mjs`, les workers
dans `dist/dist/`, les dépendances runtime et `dist/index.cjs` pour démarrer le serveur unique sous la racine
d'application Plesk `dist`. Le lanceur racine reste un point d'entrée de compatibilité.
Les chemins absolus, les ports et
les comptes système Plesk restent à vérifier sur le serveur ; `dist/public` est le
Document Root, tandis que l'interface privée est servie par Node et ne doit pas être
exposée comme un répertoire statique Apache.

## Runtime et routage à confirmer sur Plesk

- La version Node du constructeur figure dans les manifestes. Le build et le workflow
  GitHub Actions sont épinglés sur Node.js 24.22.3 et pnpm 10.26.1, pour correspondre à
  la version affichée dans le panneau Plesk. Reconfirmer cette version si le panneau la
  modifie et vérifier l'archive native après redémarrage.
- L'archive des dépendances API est construite pour Linux x64/glibc (runner GitHub
  `ubuntu-latest`). Elle contient notamment `argon2` et `sharp`; leurs modules natifs
  sont testés pendant le build sous Node.js `24.22.3`. La compatibilité exacte doit être
  confirmée avec l'architecture et
  la distribution système de l'hébergement Plesk ; aucun accès serveur ne permet de
  la certifier depuis ce dépôt.
- Vérifier la prise en charge du démarrage `index.cjs`/import ESM par le gestionnaire
  de processus Plesk. Un test local d'adaptateur ne certifie pas Passenger.
- Plesk doit démarrer un seul processus Node pour le domaine marchand. Les chemins
  `/api` et `/api/...` sont délégués à Express dans ce processus, sans `proxy_pass` vers
  un second port ni deuxième application.
- Injecter les variables de sécurité dans l'environnement de cette seule application.
  Les Secrets Replit ne sont pas transférés par le paquet Plesk. Le jeton d'accès admin
  n'est jamais placé dans l'URL et n'est pas journalisé.
- Les cookies de garde et de session sont sécurisés et limités au même hôte. L'API doit
  rester accessible sous la même origine HTTPS que l'interface, via le préfixe `/api`.
- Les journaux d'accès du proxy ou d'Apache peuvent enregistrer les chemins demandés.
  Avant d'utiliser un chemin confidentiel en production, vérifier que la configuration
  Plesk/Apache n'en conserve pas la valeur en clair; ce dépôt ne configure pas ces journaux.
- Les API inconnues doivent rester des erreurs API, pas du HTML de la SPA. Un fichier
  JS/CSS absent doit rester un 404 ; les routes SPA valides doivent accepter un refresh.
- Saisir dans l'environnement de la seule application Plesk les noms requis :
  `NODE_ENV`, `SENDFLOW_DATABASE_TARGET`, `TRUST_PROXY_HOPS`,
  `SUPABASE_DATABASE_URL` (ou `DATABASE_URL` pour compatibilité),
  `DATABASE_CA_CERT`, `CORS_ALLOWED_ORIGINS`, `TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY`, `SESSION_SECRET`, `CUSTOMER_PII_ENCRYPTION_KEY`,
  `ADMIN_SECRET_PATH`, `ADMIN_SECRET_TOKEN`,
  `SENDFLOW_ADMIN_JWT_PRIVATE_KEY`, `SENDFLOW_ADMIN_JWT_PUBLIC_KEY` et
  `SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY`. Les fonctions FeexPay requièrent aussi
  `FEEXPAY_API_KEY` et `FEEXPAY_SHOP_ID`. Utiliser la même base Supabase existante ;
  ne pas créer ni sélectionner une autre base. La connexion vérifie TLS et le certificat.
  `PORT` est facultatif pour ce serveur ; ne lui donnez pas une valeur fixe arbitraire.
- Si un démarrage échoue, le lanceur consigne une catégorie d'erreur et uniquement les
  noms des variables absentes ; il ne consigne aucune valeur. Le runtime écrit aussi le
  résultat de la vérification DB sous forme de catégorie sûre, jamais l'URL ni le certificat.
- `TURNSTILE_SITE_KEY` est fournie à l'interface au runtime par
  `GET /api/auth/turnstile-config`. `TURNSTILE_SECRET_KEY` sert à la validation serveur
  Cloudflare Siteverify : elle ne doit jamais être renvoyée, utilisée dans `VITE_*`, ni
  copiée dans le dépôt ou un bundle client. Le contrôle Turnstile reste côté serveur.
- `CORS_ALLOWED_ORIGINS` contient les origines HTTPS exactes autorisées ; le navigateur
  marchand continue d'appeler l'API en same-origin via `/api`. `TRUST_PROXY_HOPS` doit
  correspondre à la chaîne de proxys réellement observée. Ne pas reprendre les variables
  de prévisualisation Replit.
- Préserver la vérification TLS de PostgreSQL, les sessions sécurisées, les contrôles OTP/PIN,
  les rôles et les protections financières. Ce build n'autorise aucun paiement.
- Le Document Root du site est `dist/public` ; `dist/admin`, le bundle serveur, les
  `.map`, le manifeste et les fichiers de configuration ne doivent pas être exposés par
  Apache. Les requêtes doivent passer par Node afin que le contrôle IP et la sélection
  de bundle s'appliquent. Cloudflare Access, TLS et le pare-feu doivent être configurés
  et testés sur l'hébergement ; ce build ne les active pas.

## Livraison, vérification et retour arrière

1. Conserver la release précédente, son manifeste et sa configuration privée ; confirmer
   une sauvegarde/restauration de la base configurée avant toute évolution nécessitant une migration.
2. Construire dans une nouvelle release et vérifier les manifestes et droits de lecture.
   Ne pas employer `chmod 777` ni remplacer les propriétaires sans vérifier les comptes.
3. Vérifier DNS, certificat et chaîne proxy avant redirection HTTPS et bascule.
4. Après autorisation de déploiement : redémarrer l'application unique et vérifier les logs,
   les pages publiques, les assets, les routes imbriquées, les trois endpoints d'inscription
   et la santé. Vérifier les sessions avec un compte autorisé, sans paiement réel.
5. En cas d'échec, rétablir la release et la configuration précédentes, redémarrer
   l'application unique et recontrôler les mêmes chemins. Ne pas restaurer ou modifier la base
   automatiquement pour un retour de code ; la compatibilité des schémas est distincte.

Sans accès authentifié à Plesk, DNS/proxy/SSL/runtime/production restent à vérifier.
Un succès de compilation n'est pas une validation de l'exploitation financière.
