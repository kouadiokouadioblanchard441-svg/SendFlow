# SendFlow — audit cryptographique et sécurité

Date de l’audit : 15 novembre 2026.

## Périmètre et limites

Audit du code Node.js/Express, des schémas PostgreSQL/Drizzle, des migrations
financières, de l’authentification et des protections de données. Des comptages
en lecture seule ont été exécutés sur la base Supabase connectée à Replit.

Aucune migration, écriture SQL, modification de solde, transaction réelle ou
publication n’a été exécutée. La configuration Plesk et ses secrets ne sont pas
accessibles depuis cet espace. Cet audit ne constitue ni un pentest complet ni
une certification de sécurité.

## Mesures confirmées dans le code

- Nouveaux mots de passe client et nouveaux PIN client : Argon2id, 65 536 KiB,
  trois itérations, un lane, sel aléatoire de 16 octets et sortie de 32 octets.
  Les paramètres des hash lus sont bornés avant la vérification.
- Les anciens hash scrypt de mots de passe et de PIN restent vérifiables.
  Après une authentification réussie, ils sont remplacés par un hash Argon2id.
  Il n’y a pas de conversion hors ligne des hash.
- Les tentatives de PIN restent limitées par compte et demandeur, avec verrous
  PostgreSQL inter-instances. Cette protection est essentielle pour un PIN à
  quatre chiffres et ne doit pas être affaiblie.
- Les données personnelles prises en charge par le chiffrement applicatif
  utilisent AES-256-GCM, un nonce aléatoire de 12 octets, un tag de 16 octets et
  une séparation des usages par HKDF-SHA256. Les index de recherche couverts
  utilisent HMAC-SHA256.
- Les cookies de session sont `Secure`, `HttpOnly` et préfixés `__Host-`.
  L’accès administrateur combine JWT RS256 de cinq minutes et vérification de
  session serveur, avec 15 minutes d’inactivité et 8 heures au maximum.
- Les paiements existants utilisent des transactions SQL, des verrous,
  l’idempotence et des contraintes. Le grand livre et plusieurs historiques
  financiers ont des protections append-only en base.

Les formats exacts, la rotation des clés et les limites de transport sont aussi
détaillés dans [la procédure de gestion des clés](key-management.md).

## Résultats de la lecture seule Supabase

La connexion Replit a utilisé TLS avec validation du certificat. Les tables
consultées existent. Les tables `sf_users`, `sf_customer_credentials`,
`sf_contacts`, `sf_transactions`, `sf_payment_attempts`,
`sf_payment_confirmations`, `sf_payout_requests`, `sf_wallet_ledger`,
`sf_customer_identity_requests` et `sf_customer_identity_uploads` avaient zéro
ligne au moment de la vérification. Les colonnes personnelles examinées dans
les tables de comptes, contacts, transactions, paiements, retraits, campagnes,
intégrations et identité n’avaient pas de valeur enregistrée.

`sf_super_admin_credentials` était vide : aucun compte Super Admin n’est
initialisé dans cette base. `sf_admin_audit_logs` contenait cinq lignes ; les
champs `resource_id` et `reason` ne correspondaient à aucun motif d’adresse
e-mail ou de numéro de téléphone. Les autres valeurs des journaux n’ont pas été
extraites.

### Blocage critique de privilèges

Le rôle utilisé par la connexion Supabase Replit avait `BYPASSRLS`,
`CREATEROLE` et `CREATEDB`, ainsi que `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
`TRUNCATE`, `REFERENCES` et `TRIGGER` sur 67 tables publiques. Ce rôle est trop
puissant pour un runtime applicatif financier. Ses droits n’ont pas été
modifiés : les remplacer sans rôle de repli validé pourrait interrompre
l’application ou ses protections. La correction requiert un rôle runtime
distinct, sans privilèges d’administration ni `TRUNCATE`, testé sur une base
isolée avant une configuration Plesk.

## Configuration externe à compléter

- Au moment de la lecture initiale, `CUSTOMER_PII_ENCRYPTION_KEY` et le keyring
  historique étaient absents des Secrets Replit. Le propriétaire a ensuite
  ajouté `CUSTOMER_PII_ENCRYPTION_KEY` via le formulaire sécurisé. La valeur
  n’a pas été consultée. Il reste à confirmer que Plesk utilise la même clé.
  Sans clé correspondante sur chaque hôte, le chiffrement et le déchiffrement
  des données personnelles échouent de manière fermée. Les paramètres Plesk
  n’ont pas été vérifiés.
- Le code envoie HSTS en production, mais TLS se termine sur le proxy. TLS 1.3
  doit être vérifié côté Plesk/Nginx ; le code seul ne peut pas confirmer la
  version négociée.
- Le paquet Plesk complet exige Node.js 24.22.2. L’environnement Replit fournit
  24.22.1 : le script de production s’arrête volontairement sur cet écart. Le
  paquet doit être reconstruit avec la version exigée avant l’envoi à Plesk.

## Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `test:auth` | 48 réussis |
| Intégration financière isolée | 32 réussis, 9 échecs existants/non liés au changement PIN |
| Vérification de migration PIN en base PostgreSQL jetable | Réussie : nouveau hash Argon2id et mise à niveau du scrypt après PIN correct |
| Tests de connexion DB | 21 réussis |
| Tests de préparation Plesk | 19 réussis |
| Tests de routage et d’inscription frontend | 33 réussis |
| Typecheck du monorepo | Réussi |
| Build API | Réussi |
| Build complet de production Plesk | Bloqué par Node.js 24.22.1 au lieu de 24.22.2 |

Les neuf échecs de la suite financière concernent des attentes de routes qui
reçoivent 404/503, une assertion de quota et le parcours d’accès à la base de
prévisualisation. Ils ne proviennent pas du nouveau chemin Argon2id PIN. Aucun
appel fournisseur ni paiement réel n’est déclenché par cette suite.

Le scanner de dépendances n’a relevé aucune vulnérabilité. Les alertes
statiques examinées portent sur du SQL de migration fixe/paramétré, le SHA-1
standard RFC des codes TOTP et des données factices dans un test de
journalisation. Aucun test d’exploitation Strix n’a été exécuté.

## Ordre de mise en production

1. Configurer la même clé PII côté serveur dans Replit et Plesk.
2. Créer et tester un rôle PostgreSQL runtime à privilèges minimaux, sans
   modifier le compte actuel avant validation complète.
3. Vérifier TLS 1.3 côté Plesk/Nginx et refaire le paquet avec Node.js 24.22.2.
4. Traiter les neuf échecs de la suite d’intégration isolée, puis refaire les
   vérifications avant tout déploiement.
