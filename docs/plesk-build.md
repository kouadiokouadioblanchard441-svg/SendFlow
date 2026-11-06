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

Depuis la racine du dépôt, avec la version pnpm déclarée dans `package.json`
(`pnpm@10.26.1`) :

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
puis compile uniquement API et SendFlow (pas le mockup-sandbox). Il génère :

| Service | Racine de distribution relative au dépôt | Startup Plesk |
| ------- | ---------------------------------------- | ------------- |
| Site    | `artifacts/dist`                         | `index.cjs`   |
| API     | `artifacts/api-server/dist`              | `index.cjs`   |

Les adaptateurs CommonJS importent les bundles ESM existants et exigent
`NODE_ENV=production`. La logique n'est pas dupliquée. Chaque distribution contient
un manifeste privé `plesk-manifest.json` avec version du constructeur, empreinte du
lockfile, révision source, état des fichiers suivis et empreintes SHA-256 des fichiers.
Le manifeste ne contient aucune variable secrète. Les deux packages Plesk
`artifacts/dist` et `artifacts/api-server/dist` sont explicitement suivis par Git afin
que le Pull les récupère avec le code. Le build génère aussi un `index.cjs` à la racine
du dépôt pour le réglage de démarrage Plesk affiché dans la capture. La sortie native
Vite `artifacts/sendflow/dist` reste ignorée et n'est pas nécessaire à l'exécution Plesk.

## Auto-déploiement déclenché par un push

Le flux prévu est le suivant : générer et committer les packages de production avec
`pnpm run build:plesk`, pousser le commit, puis laisser Plesk récupérer `main`. Les
fichiers compilés sont dans le commit ; le serveur n'a pas à compiler les sources après
le Pull. Aucun workflow GitHub ne se connecte en SSH au serveur et aucun secret SSH
n'est requis.

Dans les paramètres du dépôt Git Plesk, l'auto-déploiement doit être activé et cette
commande configurée comme action après le Pull, depuis le checkout SendFlow :

```sh
bash scripts/plesk/build-after-pull.sh
```

Le script retrouve le checkout avec Bash et vérifie les fichiers compilés suivis par
Git. Il n'appelle ni Git, ni `dirname`, ni Node, ni pnpm : le hook reste utilisable dans
l'environnement restreint de déploiement Plesk. Il échoue avec la liste des fichiers
manquants au lieu de déclarer qu'un package incomplet est prêt. Le build doit être
exécuté sous Node.js `24.22.2` avant le commit et le Push.

Configurer les racines et fichiers de démarrage des applications Node Plesk :

| Service | Application root relative au checkout | Fichier de démarrage relatif à cette racine |
| ------- | --------------------------------------- | ------------------------------------------- |
| Site    | `.`                                     | `index.cjs`                                 |
| API     | `artifacts/api-server`                  | `dist/index.cjs`                            |

Le dossier `artifacts/dist/public` contient les fichiers statiques, mais ils doivent
être servis par le serveur Node du site pour conserver le contrôle IP appliqué par
l'application. Ne pas exposer directement le dossier par un serveur statique Nginx
ou Apache sans protection équivalente. Le `index.cjs` racine est un adaptateur généré
qui importe le bundle site déjà suivi par Git. Le serveur Plesk doit démarrer les deux
processus Node nécessaires (site et API), chacun avec ses variables privées.

## Écart avec la proposition `/httpdocs/dist`

La compétence fournie mentionne une **proposition à vérifier**, pas un accès Plesk
observé : `/httpdocs/dist`, `/httpdocs/dist/public`, `index.cjs`, Node 22.23.3.
Le build crée `index.cjs` à la racine, `artifacts/dist/index.cjs` et
`artifacts/dist/public` pour le site, ainsi que la distribution API séparée.

Selon l'emplacement réel du checkout, configurer deux applications/processus Node,
ou préparer une autre architecture explicitement approuvée. Les chemins absolus, les
domaines, les ports et les comptes système Plesk sont inconnus ici. Ne pas les inventer.
Ne pas écraser une ancienne release fonctionnelle pour faire correspondre un chemin.

## Runtime et routage à confirmer sur Plesk

- La version Node du constructeur figure dans les manifestes. Le build local vérifié a
  été généré sous Node.js 24.22.2. L’utilisateur indique également que le runtime
  Plesk est en 24.22.2, mais son exécution réelle reste à confirmer sur le serveur.
  Le fonctionnement sous une autre version, dont Node 22.23.3, n’est pas démontré.
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
- Préserver la vérification TLS de PostgreSQL, les sessions sécurisées, les contrôles OTP/PIN,
  les rôles et les protections financières. Ce build n'autorise aucun paiement.
- Le Document Root ne doit exposer ni bundle serveur, ni `.map` privés, ni manifeste,
  ni fichiers de configuration. Le seul arbre publiable est `dist/public` du site.
- **Attention :** si Nginx/Apache sert directement cet arbre sans passer par Node,
  les contrôles IP applicatifs sont contournés pour ces requêtes. Désactiver ce
  contournement ou prouver une protection équivalente au proxy avant toute bascule.
  L'API n'a pas de Document Root à exposer ; utiliser un répertoire public vide privé
  des fichiers serveur si Plesk exige un champ Document Root.

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
