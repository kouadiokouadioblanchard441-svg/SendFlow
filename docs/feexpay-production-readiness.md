# FeexPay — vérification avant paiements réels sur Plesk

Date : 23 octobre 2026.

## Conclusion

**Pas encore prêt pour des paiements réels de bout en bout.** Le client REST,
le catalogue et les structures SQL existent. Le service d'exécution, sa route
client et la reprise durable des paiements ne sont pas implémentés. Un build
Plesk valide ne comble pas ces manques et ne prouve pas la configuration du
serveur de production.

Aucune page ni aucun style client n'a été modifié pendant cette intervention.
Aucun paiement, appel à l'API de paiement, déploiement ou changement de données
financières réelles n'a été effectué.

## Vérifications et corrections réalisées

| Contrôle | Résultat et limite |
| --- | --- |
| API de l'aperçu | Redémarrage réussi après rétablissement du secret de connexion manquant ; `/api/healthz` retourne HTTP 200. Ne prouve pas la santé de Plesk. |
| Site de l'aperçu | Une capture initiale montrait encore HTTP 503 ; le redémarrage du serveur des pages après l'ajout du secret a rétabli HTTP 200 sur `/`, sans modification des pages. |
| Schéma Neon partagé | Programme existant exécuté en transaction `READ ONLY` : migration des structures de paiement déjà appliquée, aucun conflit détecté, aucune écriture. |
| Type d'intégration | REST direct depuis le serveur, sans checkout hébergé ni SDK dans le navigateur. |
| Champs de redirection | Suppression de `returnUrl`/`cancelUrl` du contrat du client et rejet explicite des anciens appels ; aucun `return_url`/`cancel_url` envoyé. |
| Chemins Payout et statut | Comparaison avec le contenu public de la documentation officielle, y compris son composant JavaScript pour les sections qui ne rendaient que « Loading ». |
| Matrice de requêtes | Tests avec transport injecté et identifiants synthétiques : 16 canaux XOF Payin et 15 Payout ; Coris Bénin n'a pas de Payout. |
| Congo | Payin et Payout restent refusés avant réseau, pour XOF comme pour XAF ; la présence du canal dans le catalogue n'active pas XAF. |
| Secrets | Contrôle existant sur 725 fichiers texte : aucun signalement. Ce n'est pas un audit de tout l'historique Git, des binaires ou de Plesk. |
| Construction Plesk | Commande `pnpm run build:plesk` réussie ; aucune mise en ligne. |

## Tests effectivement exécutés

- `pnpm --filter @workspace/api-server run test:feexpay` : **49 réussis, 0 échec**.
- `pnpm run typecheck` : réussi ; également inclus dans la construction Plesk.
- `pnpm run build:plesk` : réussi. Inclut **10 tests de distribution réussis**,
  la compilation API/web et les contrôles des fichiers distribués.
- `pnpm --filter @workspace/api-server run payments:schema-plan` : contrôle
  en lecture seule, migration déjà appliquée et liste de conflits vide.
- Vérification de disponibilité de l'API de l'aperçu : HTTP 200.

Les tests de protocole interceptent tous leurs appels HTTP. Ils ne valident
ni une clé réelle, ni un solde marchand, ni la réception réelle d'un versement.
La construction a émis des avertissements Vite sur la taille d'un bundle et
la localisation de sources ; elle s'est terminée avec succès.

Les deux écarts du précédent audit (test de hash de session dépendant de
l'environnement et règle de test SQL incompatible avec les requêtes
paramétrées du service de défense réseau) n'ont pas été corrigés ni rejoués
dans ce lot. Les résultats ci-dessus ne signifient pas que toute la suite
globale est verte.

## Blocages confirmés et risques

### Bloquant — moteur de paiement non raccordé

Preuves :

- `artifacts/api-server/src/routes/index.ts` monte le devis, pas une création
  de paiement client.
- `artifacts/api-server/src/services/transfer-quote.ts` calcule un devis en
  lecture seule.
- `artifacts/sendflow/src/lib/transaction-readiness.ts` laisse les soumissions
  financières désactivées.
- `artifacts/api-server/src/providers/feexpay/client.ts` est un client de
  protocole, sans orchestration du registre et des réservations.

Reste à construire : création atomique et idempotente, validation définitive,
enregistrement de l'envoi avant l'appel externe, encaissement puis versement
pour l'inter-réseaux, confirmation vérifiée, règlement atomique et reprise
après interruption. Voir le contrat de
`lib/db/migrations/payment-execution-structures.md`.

Ne pas contourner ce blocage en activant uniquement un bouton ou une variable.

### Haut — preuves nécessaires au règlement à définir précisément

Les exemples v2 de statut documentent référence, montant et statut, mais pas
de champ `currency`. Le parseur ne doit pas inventer cette valeur. Le moteur
doit disposer d'un lien vérifiable entre compte marchand, canal, devise et
tentative persistée. Une réponse POST, un webhook brut ou une redirection ne
suffisent pas pour créditer ou débiter un portefeuille.

Aucune authenticité de webhook FeexPay n'a été démontrée par cette intervention.
À défaut d'un mécanisme documenté et vérifié, une notification ne doit être
qu'un signal pour consulter le statut authentifié auprès du prestataire.

### Haut — reprise et situations incertaines

Un POST dont la réponse est perdue peut avoir été traité. Ne pas le renvoyer
automatiquement, libérer une réservation ou marquer l'opération en échec.
Prévoir un rapprochement durable et un traitement contrôlé des remboursements.
Les tables existantes imposent des contraintes ; elles ne remplacent pas ces
services applicatifs.

### Non vérifié — droits et contrats réels des canaux

Les tests figent les chemins et les corps attendus par le client ; ils ne
démontrent pas l'acceptation par FeexPay de chaque valeur `network`, des champs
optionnels, des limites ou des formats de téléphone. Le plafond générique
100–2 000 000 n'est pas une validation des limites de chaque opérateur.

Les droits Payin/Payout du compte marchand, les frais prestataire, les
autorisations par pays/opérateur et la liquidité n'ont pas été contrôlés.

### Non vérifié — environnement effectif Plesk

Restent à contrôler sur le serveur réel : version Node, processus et tâches
planifiées, reverse proxy, HTTPS, cookies, origines autorisées, accès sortant
et restrictions IP du prestataire, rôle PostgreSQL, secrets, sauvegardes et
journaux. Les variables de l'aperçu ne prouvent aucun de ces réglages.

Le mode réel Plesk attend notamment `NODE_ENV=production`,
`SENDFLOW_DATABASE_TARGET=production`, `FEEXPAY_EXECUTION_HOST=plesk` et
`FEEXPAY_MODE=live`. **Conserver `FEEXPAY_LIVE_ENABLED=false` tant que le
cycle complet n'a pas été raccordé et validé.** Ne pas copier ces réglages
dans l'aperçu comme substitut à une vérification de Plesk.

## Ordre de travail avant ouverture

1. Finaliser le contrat des canaux et des preuves de statut.
2. Implémenter le moteur serveur et son API, en réutilisant les tables et
   contraintes existantes, avec tests PostgreSQL isolés et prestataire simulé.
3. Raccorder les formulaires existants sans changement d'apparence et tester
   la persistance, les échecs, la concurrence et les reprises.
4. Vérifier les deux services sur Plesk, sans mouvement de fonds.
5. Autoriser séparément une opération réelle précisément définie
   (compte, sens, montant, devise et destinataire), puis rapprocher son résultat.

En retour arrière, arrêter d'abord les nouveaux envois et rapprocher les
opérations en cours. Ne pas supprimer les tables de suivi, les preuves ou
les réservations pour revenir à une ancienne version.

## Sources

- https://docs.feexpay.me/?section=api-rest-integrations&version=v2
- https://docs.feexpay.me/?section=services-payout&version=v2
- https://docs.feexpay.me/?section=api-rest-status&version=v2
- https://docs.feexpay.me/?section=api-payout-status&version=v2
- https://docs.feexpay.me/?section=webhook&version=v2
