# Compte de visualisation sur Neon partagé

## Autorisation et périmètre

Le propriétaire a choisi d'utiliser la base Neon déjà connectée, et a autorisé uniquement l'accès du compte de visualisation depuis l'aperçu.

Aucune page ni aucun composant frontend n'est modifié par ce lot.

Le compte est un nouvel utilisateur, avec un wallet à zéro et un téléphone non vérifié. Aucun compte existant n'est transformé en compte de visualisation. Le nom générique « Visualisation » n'est pas une identité client vérifiée et aucune date de naissance n'est inventée.

Le code ne contient aucun identifiant réel, mot de passe ou PIN de ce compte.

## Protections

- Une table interne limite l'autorisation à un seul utilisateur. Elle n'est pas gérable par une API publique.
- L'autorisation expire après sept jours ; la révocation et l'expiration sont vérifiées côté serveur.
- Le mot de passe conserve le scrypt salé existant, avec une version réservée à l'aperçu, refusée par le vérificateur de production.
- Les sessions ont une portée cryptographique et un préfixe distincts. Un cookie de production ne permet pas d'entrer dans l'aperçu, et inversement.
- Deux contrôles SQL empêchent un ancien serveur partageant Neon de convertir ce mot de passe en mot de passe client normal ou de créer une session client normale pour cet utilisateur.
- Ces contrôles lisent leur table interne avec les seuls droits de leur propriétaire et un chemin SQL fixé à `pg_catalog`, sans SQL dynamique. Les anciens rôles applicatifs n'ont pas besoin de nouveaux droits sur la table d'autorisation pour continuer à authentifier les clients normaux.
- Le PIN est créé par le propriétaire dans l'interface habituelle. Sa définition et son déverrouillage utilisent les contrôles, verrous et limites de tentatives existants.
- Une liste fermée de routes permet la consultation du compte, de ses transactions, de ses limites et de son état KYC, ainsi que les devis.
- Les lectures et connexions sont filtrées par l'autorisation en SQL. Une autre session authentifiée ne suffit pas.
- Les demandes de paiement, modifications financières, routes administrateur, inscriptions, récupération par SMS et appels Didit/eSMS sont refusés avant les contrôleurs concernés.
- L'authentification nécessite toujours un vrai mot de passe et un vrai PIN ; aucun drapeau navigateur ne permet de contourner ces contrôles.

Les écritures permises sont celles nécessaires au compte lui-même : sessions, activités de connexion, compteurs anti-brute-force, PIN et quota de devis. Il ne s'agit pas d'un accès SQL global en lecture seule.

## Création explicite

La préparation du code ne crée aucun compte au démarrage.

Après ajout des deux secrets d'initialisation `SENDFLOW_VIEWER_PHONE` et `SENDFLOW_VIEWER_PASSWORD`, l'opérateur peut exécuter :

```sh
node artifacts/api-server/scripts/provision-preview-account.mjs --confirm-shared-neon
```

La commande exige le mode partagé explicite dans Replit, utilise la connexion déjà configurée et vérifie les colonnes nécessaires. Elle applique uniquement la migration additive `2026-10-22-preview-access.sql`, sans `drizzle push` global ni migration financière indépendante.

La migration ajoute la table d'autorisation et deux contrôles de portée sur les écritures de mots de passe et de sessions. Elle n'actualise aucune ligne existante. Un délai de verrouillage court arrête la commande si la base est occupée.

La création de l'utilisateur, du hash, du wallet à zéro, de l'autorisation et de l'audit est atomique. Un numéro déjà utilisé ou une autorisation déjà présente provoque un refus, pas un remplacement.

La version de consentement enregistrée distingue l'autorisation interne du propriétaire d'une acceptation de conditions client ou d'une vérification d'identité. Aucun SMS, session utilisateur, faux historique ou fonds n'est généré lors de la création.

## Vérifications exécutées avant Neon

- Typecheck de l'ensemble du workspace réussi.
- 10 tests unitaires de cryptographie, séparation de portée et listes de routes réussis.
- 14 tests HTTP/SQL réussis sur PostgreSQL jetable, sans connexion aux secrets réels.
- Le parcours HTTP couvre mot de passe, création du PIN, nouveau login verrouillé, déverrouillage, déconnexion, devis et lecture du compte.
- Les tests refusent les autres utilisateurs, l'IDOR, les routes administrateur, les prestataires, les opérations financières, les grants expirés/révoqués et la réutilisation des sessions en mode normal.
- Les contrôles SQL sont testés contre des écritures simulant un ancien serveur de récupération de compte.
- Les migrations sont exécutées deux fois sur la base jetable pour vérifier leur réapplication.
- Le compteur d'appels réseau externes des tests reste à zéro ; aucun mouvement financier n'est créé pour le viewer.

Ces tests ne constituent pas une connexion navigateur au compte Neon réel.

Le 22 octobre 2026, le compte a été provisionné dans la base Neon connectée avec les identifiants transmis via Secrets. Une vérification SQL en lecture seule a confirmé une seule autorisation active, un wallet à zéro, un téléphone non vérifié et un hash réservé au mode visualisation. L'accès expire le 29 octobre 2026 à 11:05:57 UTC. Aucun identifiant n'est reproduit dans ce rapport.

## Exploitation

L'accès concerne les pages client, pas le back-office. Les fonctionnalités exigeant un paiement ou un prestataire réel restent indisponibles dans l'aperçu.

Un renouvellement, une révocation ou une réinitialisation de mot de passe doivent être des opérations explicites et auditées. Ne pas ouvrir les routes SMS pour dépanner ce compte. Ne pas supprimer sa séparation de portée lors d'un déploiement Plesk ultérieur.
