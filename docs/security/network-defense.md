# Autodéfense HTTP SendFlow

## Périmètre réel

Protection serveur des futures requêtes qui atteignent l’API Express et le serveur
web SendFlow. Les décisions sont partagées dans Neon, pas dans le navigateur.
Les pages client n’ont pas été redessinées. Les rubriques administrateur sont
« Blocage IP » et « Autodéfense ».

L’aperçu Replit utilise désormais cette protection. Rien n’a été déployé sur Plesk :
son proxy, ses routes statiques, son CDN éventuel et la chaîne de confiance IP
doivent être raccordés et vérifiés séparément. Copier uniquement les fichiers
statiques sur un hébergement ne protège pas ces fichiers par ce mécanisme.
Le build produit un serveur web Node dans `artifacts/sendflow/dist/server/index.mjs`.
Il doit recevoir les variables serveur adaptées à l’hébergement, dont `PORT`,
`TRUST_PROXY_HOPS` et la configuration Neon. Ne jamais déplacer ses secrets dans
les variables publiques Vite.

## Ordre des contrôles

1. Déduire une seule IPv4/IPv6 du socket et des sauts proxy explicitement approuvés.
   Une adresse IPv4 représentée en IPv6 est ramenée à la même identité réseau.
2. Refuser un blocage manuel actif, sans exception automatique possible.
3. Consulter l’exception administrative et un éventuel blocage automatique actif.
4. Pour les autres IP publiques, compter les requêtes et sondages en base.
5. Autoriser ensuite seulement le traitement normal : CORS, validation, session,
   PIN, permissions et métier financier restent obligatoires.

Les en-têtes de rôle, de confiance et les IP choisies par le client ne sont pas des
autorisations. Le proxy doit écraser les en-têtes transmis par les clients et le
serveur d’origine doit être protégé contre les accès directs. Ce contrat Plesk
reste non vérifié.

## Règles actuelles, décidées par le serveur

| Situation | Action |
| --- | --- |
| Chemin de reconnaissance connu, ex. `/.env`, `/.git/config`, `wp-login.php`, traversée encodée | Requête refusée immédiatement, HTTP 403 |
| 5 sondages de ce type dans une fenêtre fixe de 10 minutes | Blocage automatique définitif |
| Plus de 1 200 requêtes dans une fenêtre fixe d’une minute | Blocage automatique définitif, avec HTTP 429 au déclenchement |
| Nouvelle infraction après une levée explicite | Nouveau blocage définitif |
| IP actuellement bloquée automatiquement | HTTP 403, sans délai de déblocage annoncé |
| Blocage manuel | HTTP 403, sans expiration automatique |
| Erreur de lecture/écriture de la protection | HTTP 503, pas d’autorisation implicite |

Ce ne sont pas des fenêtres glissantes. Un sondage isolé ne déclenche pas à lui
seul un bannissement complet. Un simple 404, un User-Agent inquiétant ou une IP
d’hébergeur cloud ne constitue pas une preuve d’attaque.

Les fenêtres de comptage ne sont PAS des durées de blocage. Une décision de
blocage ne se termine jamais automatiquement : ni après une journée, ni après
un redémarrage. Seule une levée explicite, autorisée et journalisée rétablit
l’accès. Ajouter une exception ne suffit pas à lever un blocage existant.

Les requêtes de santé ne créent pas de compteur ; elles restent refusées si un
blocage s’applique déjà. Les adresses locales, privées et d’infrastructure ne
peuvent pas recevoir de bannissement automatique ni être ajoutées à la liste
manuelle depuis le panel. Les signatures de reconnaissance restent refusées
même pour l’infrastructure.

## Données et autorisations

- `sf_ip_blocklist` : blocages manuels persistants, motifs et versions.
- `sf_network_defense` : compteurs partagés et date de décision des blocages.
  `blocked_at` représente le blocage actif, sans date de fin.
  L’ancien champ `blocked_until` reste conservé pour compatibilité : une valeur
  non nulle vaut aussi blocage, même si sa date est passée, jusqu’à levée explicite.
  La migration ciblée convertit les anciennes décisions non levées en décisions
  définitives, sans réactiver celles qui avaient été explicitement levées.
- `sf_network_defense_allowlist` : exceptions explicites, motifs et révocations.
- `sf_network_defense_events` : déclenchements et levées ; historique append-only.
- Les modifications administratives sont aussi enregistrées dans le journal
  administrateur, dans la même transaction que la modification.

Les compteurs, décisions et événements ne conservent ni corps HTTP, ni paramètres
de requête, ni mots de passe, ni clés prestataires. Ils contiennent des adresses
IP : ce sont des données de sécurité à accès restreint, pas des données anonymes.
La purge et la durée de conservation doivent encore être définies ; il n’existe
pas de tâche de purge automatique dans cette livraison.

Une exception ne contourne que la détection automatique future. Elle ne débloque
aucune IP déjà bloquée, manuellement ou automatiquement, et ne donne aucun droit
administrateur ou financier. Les décisions de blocage sont prioritaires même si
une ancienne exception existe en base.
Les actions exigent les autorisations serveur existantes, une origine approuvée,
un motif, une validation stricte et, pour les révocations/levées, la version
actuelle. Les mutations réseau sont limitées à 30/minute par administrateur.
L’accès administrateur réel est encore désactivé : aucun raccourci n’a été ajouté.

Les compteurs sont sérialisés par PostgreSQL. Deux processus ne créent pas deux
événements pour le même déclenchement. Une erreur d’audit annule la modification.
La lecture du panel est bornée aux 100 enregistrements de blocage récents et
500 exceptions ; ce n’est pas un outil d’historique exhaustif.

## Vérifications réellement exécutées

- 4 tests unitaires : IPv4/IPv6, alias IPv4-mapped, entrées invalides,
  confiance proxy et classification des chemins.
- 28 tests HTTP/SQL dans PostgreSQL jetable, dont les tests financiers existants.
  Les migrations ciblées ont été exécutées deux fois dans cette base pour vérifier
  leur réexécution.
- Cas vérifiés : blocage manuel, auto-blocage, double création concurrente,
  absence d’expiration malgré le temps écoulé, conversion des anciens blocages,
  récidive après levée, partage entre deux workers, refus des pages/fichiers,
  exceptions, priorité du blocage manuel, CSRF, versions périmées, audit atomique,
  historique protégé et refus des faux privilèges administrateur.
- Vérification TypeScript complète, build client/serveur et contrôle de secrets
  du dépôt réussis.
- Après redémarrage : accueil et santé HTTP 200 ; capture mobile de l’accueil
  sans erreur navigateur.

Les attaques ont été simulées uniquement dans la base jetable. La migration Neon
a créé les tables dédiées sans modifier comptes, soldes ou transferts. Aucune
adresse réelle n’a été ajoutée manuellement ou attaquée pendant les tests.
Les actions du panel n’ont pas été parcourues dans un navigateur connecté :
l’authentification administrateur réelle reste fermée.

## Limites et exploitation

Cette protection n’identifie pas toute attaque et ne remplace pas un WAF, un
pare-feu réseau ou une protection DDoS chez l’hébergeur. Elle ne bloque pas
l’accès réseau direct à PostgreSQL : cela relève aussi de Neon, des permissions
et des identifiants de base.

Une IP peut appartenir à plusieurs clients mobiles ; les seuils devront être
observés et ajustés avec prudence. Une personne peut changer d’IP. Le contenu déjà
chargé ou servi directement depuis un cache/CDN n’est pas révoqué. Le trafic
WebSocket applicatif n’a pas été ajouté ; le serveur de fichiers de production
refuse les upgrades. Le canal HMR de développement n’est pas une interface
financière et n’est pas une preuve de protection WebSocket en production.

Les contrôles applicatifs consultent la base à chaque requête et écrivent les
compteurs : ils ne sont pas une défense suffisante contre une saturation réseau
ou de base. Il faut une première limitation au reverse proxy/WAF avant l’origine.

En cas de faux positif, une levée explicite ou une exception auditée est possible
depuis un accès administrateur autorisé et non bloqué. Si tous les accès sont
perdus, utiliser une maintenance serveur authentifiée ; ne pas créer de route
publique de secours. Une panne de base laisse volontairement le site en 503.

Un retour à une ancienne version du code peut supprimer la protection automatique.
Conserver les tables et l’historique, ne pas les supprimer pour remettre le site
en service. Toute modification du proxy, des seuils ou des exceptions doit être
vérifiée en environnement isolé avant activation.
