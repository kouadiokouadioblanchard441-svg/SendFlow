# Structures de suivi des paiements — périmètre et exploitation

## Ce que cette migration fait

Migration ciblée : `2026-10-22-payment-execution-structures.sql`.
Elle ne réécrit aucune ligne existante et n'active aucun pays, opérateur ou
prestataire. Aucun appel FeexPay n'est exécuté par le programme de migration.

| Table | Rôle |
| --- | --- |
| `sf_payment_intents` | Figer la transaction, le prestataire choisi, la devise et les calculs serveur. |
| `sf_payment_attempts` | Conserver une seule étape d'encaissement et une seule étape de versement par intention ; enregistrer l'envoi avant tout appel externe. |
| `sf_payment_confirmations` | Conserver des preuves vérifiées et chiffrées, liées à la référence, au montant et à la devise attendus. |
| `sf_wallet_payment_reservations` | Réserver le débit total d'un transfert international sans réduire le solde comptable avant confirmation. |
| `sf_payment_schema_versions` | Tracer la migration et détecter une définition SQL modifiée. Ce n'est pas une table métier accessible aux clients. |

Deux nouveaux contrôles concernent des tables existantes :

- `sf_wallets` : empêcher de dépenser des fonds déjà réservés ;
- `sf_transactions` : figer les données financières lorsqu'une intention existe
  et interdire un statut final non confirmé par cette intention.

Les anciennes transactions sans intention conservent leur fonctionnement.
Les historiques de paiement ne sont ni supprimables ni tronquables ; les preuves
sont immuables. Les tables et fonctions ajoutées n'accordent aucun droit à PUBLIC.
Cette migration ne remplace pas la politique de rôles PostgreSQL de l'hébergement.

## Contrat du futur service d'exécution

**Ces structures ne constituent pas, à elles seules, un moteur de paiement.**
Elles n'ajoutent ni route de création de paiement, ni ordonnanceur de
rapprochement, ni activation du bouton de confirmation client.

Le service doit encore :

1. Authentifier, autoriser, vérifier le PIN/OTP et la conformité ; recalculer le
   devis à partir de la configuration serveur et vérifier l'idempotence.
2. Créer la transaction et son intention atomiquement, avec une référence et
   une empreinte de requête générées côté serveur. Ne pas rattacher
   automatiquement une ancienne transaction possédant déjà une référence
   prestataire : son résultat doit d'abord être rapproché.
3. Réserver les fonds pour l'international, puis persister l'étape préparée.
   La réservation couvre le **total expéditeur**, frais compris selon le
   choix de prise en charge. Le versement couvre le **net destinataire**.
4. Revendiquer l'étape par une mise à jour conditionnelle
   `prepared -> dispatching`, vérifier qu'une ligne a été modifiée, puis
   **committer avant** d'appeler FeexPay. Ne jamais appeler le prestataire
   depuis une transaction SQL susceptible d'être rejouée.
5. Ne jamais réémettre un envoi dont le résultat est incertain. Conserver
   l'état `uncertain`, la référence connue et la réservation ; rapprocher
   auprès du prestataire ou demander une décision contrôlée.
6. Vérifier réellement l'origine/authenticité des confirmations, puis
   rapprocher référence, montant, devise et compte prestataire. Les valeurs
   `provider_status` et `verified_webhook` sont des **étiquettes de sources** :
   leur présence en base ne vérifie pas une signature.
7. Chiffrer les références avec la fonction de chiffrement serveur et les
   preuves avec le contexte `payment-confirmation-payload`. Produire
   l'empreinte de référence avec un contexte incluant prestataire, direction
   et référence, pour distinguer les espaces d'identifiants des prestataires.
   Ne jamais recevoir une preuve, une empreinte ou un état final du navigateur.
8. Pour le règlement, utiliser **une seule transaction SQL et une seule
   connexion** : verrouiller le compte/portefeuille, créer l'écriture de
   registre unique, consommer la réservation si nécessaire, modifier le solde,
   finaliser l'intention et la transaction, puis auditer. Les tests reproduisent
   cette séquence, mais aucun service métier ne l'exécute encore en production.
   Ne jamais consommer une réservation dans une transaction séparée du débit.
9. Utiliser les clés d'écriture stables `payment:<intent-id>:credit` pour un
   dépôt et `payment:<intent-id>:debit` pour l'international. Un transfert
   inter-réseaux ne débite pas de portefeuille SendFlow.
10. Prévoir un rapprochement durable et des procédures de remboursement.
    `refund_due` ne rembourse rien automatiquement et ne signifie pas que
    l'opération est définitivement soldée.

Les verrous des réservations versionnent aussi la ligne du portefeuille :
un simple verrou ne suffit pas lorsqu'une transaction REPEATABLE READ possède
un ancien instantané. Une erreur `40001` impose une reprise de la partie SQL
avant envoi, jamais un nouvel appel financier à l'aveugle.

La présence de XAF dans ces tables ne rend pas le client FeexPay compatible
avec cette devise. Ne pas ouvrir le Congo sans l'adaptation et la validation
correspondantes.

## Validation sans accès aux fonds réels

```sh
pnpm --filter @workspace/api-server run test:payment-structures
node artifacts/api-server/tests/security/run-isolated-finance.mjs
pnpm --filter @workspace/api-server run test:feexpay
pnpm --filter @workspace/api-server run test:sensitive-data-crypto
pnpm run typecheck
```

Le programme isolé crée un PostgreSQL temporaire sur socket Unix, désactive
TCP, ne transmet aucune connexion Neon ni clé prestataire et détruit le
cluster à la fin. Il vérifie aussi le retour arrière d'une migration dont
l'enregistrement final échoue, puis une seconde application sans changement.
Les confirmations de ces tests sont synthétiques : elles ne prouvent pas
l'acceptation d'un vrai paiement ou la validité d'une signature FeexPay.

## Application autorisée au Neon partagé

Ne jamais utiliser un `drizzle-kit push` global pour cette opération.
Le programme utilise la connexion résolue pour `shared-neon`, sans afficher
son URL, et refuse une structure préexistante non tracée ou modifiée.

```sh
pnpm --filter @workspace/api-server run payments:schema-plan
# Après examen du plan et autorisation explicite :
pnpm --filter @workspace/api-server run payments:schema-plan \
  --apply --confirm-shared-neon --expected-hash=<empreinte-du-plan>
```

L'application se fait dans une transaction, avec verrou de migration,
attente de verrou limitée à deux secondes et contrôle des empreintes des
neuf tables métier préexistantes concernées. Un volume de plus de 100 000
lignes protégées exige une révision de la procédure avant intervention.

Après une interruption ou un résultat non confirmé, relancer uniquement le
plan **en lecture seule** : `alreadyApplied: true` avec `conflicts: []`
confirme la présence de la version et la conformité de ses définitions.
Ne pas relancer aveuglément une commande d'écriture.

## Retour arrière et risques restants

Avant le commit, tout échec annule les ajouts. Après le commit, conserver les
tables et les protections ; ne pas les supprimer pour revenir à un ancien
code. Avant tout retour de version avec des paiements en cours, arrêter les
nouveaux envois et rapprocher les opérations, références et réservations.

Restent à traiter avant une ouverture réelle : moteur/API authentifiés,
comptabilisation atomique dans le service, reprise après redémarrage,
rapprochement et remboursements, preuve d'authenticité des notifications,
droits du compte prestataire, permissions effectives de Plesk, conservation
des preuves et rotation des clés. Aucune modification de page client
n'est nécessaire pour cette migration.
