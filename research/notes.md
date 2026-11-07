# Research Notes: Architecture de la documentation API SendFlow

**Status:** complete
**Depth:** Standard

## Plan

- **Question:** Comment la documentation SendFlow se compare-t-elle aux docs publiques AshTechPay, Stripe, Paystack et Flutterwave, et quels écarts concrets doivent être traités ?
- **Scope:** Organisation et parcours développeur, exemples de code, contrats API, sécurité, webhooks, erreurs et tests ; comparaison documentaire uniquement, sans modifier l’application ni attribuer à SendFlow des fonctions absentes.
- **Audience:** Propriétaire du produit et intégrateurs marchands SendFlow.
- **Deliverable:** Rapport de comparaison sourcé avec les points forts, les risques de documentation et les prochaines améliorations prioritaires.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | AshTechPay : parcours d’intégration et exemples | done | 8 pages officielles |
| 2 | Stripe : API, démarrage et résilience | done | 5 pages officielles |
| 3 | Paystack : API, sécurité et webhooks | limited | pages bloquées HTTP 403 |
| 4 | Flutterwave : parcours d’intégration et suivi | done | 6 pages officielles |
| 5 | SendFlow : structure réelle, contrats et écarts | done | docs, routes et OpenAPI local |

## Coverage Checklist

- [x] Les guides permettent-ils de comprendre un parcours complet du premier appel à la confirmation serveur ?
- [x] Les exemples couvrent-ils les routes existantes et les langages de manière cohérente ?
- [x] Les limites, réponses, erreurs, reprises et idempotence sont-elles assez explicites ?
- [x] La documentation distingue-t-elle clairement les secrets, identifiants publics et jetons de session ?
- [x] Les webhooks sont-ils expliqués avec validation, déduplication et règles de livraison ?
- [x] Quelles lacunes sont prioritaires pour SendFlow, sans copier de fonctions non prises en charge ?

## Findings Log

_[@key] markers reference sources in research/sources.json; they become numbered citations in the final report._

### AshTechPay : parcours d’intégration et exemples

- Le guide rapide va des prérequis au catalogue pays, aux frais, à la création puis à la lecture de transaction ; il propose des onglets Node.js, Python, cURL et PHP [@ashtechpay-quickstart].
- L’authentification distingue les clés Checkout, Direct API et webhook, chacune avec une finalité et un périmètre côté serveur [@ashtechpay-authentication] [@ashtechpay-hosted-checkout].
- Le guide hébergé détaille création, réponse, redirection, idempotence, confirmation serveur et webhook ; les pages erreurs et sandbox traitent aussi reprises et simulations [@ashtechpay-hosted-checkout] [@ashtechpay-errors] [@ashtechpay-sandbox].
- Le webhook inclut vérification de signature sur corps brut, réponse rapide, idempotence, relecture serveur et déduplication [@ashtechpay-webhooks].

### Stripe : API, démarrage et résilience

- Le Quickstart Checkout inclut une intégration runnable : endpoint serveur qui crée la session, redirection client, retour, lecture de session et consigne d’attendre confirmation avant fulfillment [@stripe-checkout-quickstart].
- La référence d’idempotence explique le rejeu avec même clé, mêmes paramètres, rétention et erreurs liées aux reprises [@stripe-idempotency].
- La documentation webhook couvre signature du corps brut, retour 2xx rapide, retries, doublons et ordre des événements ; un guide séparé expose les scénarios de test [@stripe-webhooks] [@stripe-testing].

### Paystack : API, sécurité et webhooks

- Les pages officielles ciblées renvoient un challenge Cloudflare HTTP 403 depuis l’environnement de recherche ; aucune affirmation sur leurs contrats n’est faite [@paystack-access-limitation].

### Flutterwave : parcours d’intégration et suivi

- Le Quickstart sépare compte, environnement de test, configuration, KYC et passage en production [@flutterwave-quickstart] [@flutterwave-authentication].
- Le guide Standard déroule requête serveur, génération du lien, redirection, callback et vérification serveur [@flutterwave-standard-checkout] [@flutterwave-transaction-verification].
- Le guide webhook couvre secret de vérification, réponse HTTP exigée, délai, retries activables, relecture de transaction et idempotence ; le guide de test sépare les scénarios simulés du mode live [@flutterwave-webhooks] [@flutterwave-testing].

### SendFlow : structure réelle, contrats et écarts

- Le portail est une page React du produit SendFlow, affichée uniquement sur `apis.docs.sendflow.africa`; son plan comprend démarrage, authentification, direct, hébergé, référence API, webhooks, états, erreurs et sécurité (`artifacts/sendflow/src/pages/docs.tsx`, `artifacts/sendflow/src/lib/documentation-host.ts`).
- Le guide utilise `GET /api/pricing`, `GET /api/payment-limits`, les sessions pay-in `/api/v1/payment-sessions` et leurs routes publiques/directes. Les exemples sont répartis entre cURL, JavaScript, Node.js, PHP, Python et Kotlin (`docs.tsx`, `docs-code-examples.ts`).
- `lib/api-spec/openapi.yaml` est une spécification OpenAPI 3.1 qui inclut le contrat marchand, mais aussi des routes d’administration. La page publique garde une liste d’endpoints séparée et maintenue dans le code ; le schéma entier ne doit pas être publié tel quel.
- Le code documente une garde de disponibilité fermée : création de session et démarrage de tentative renvoient HTTP 503 tant que `LINKFLOW_SETTLEMENT_PROOF_READY` vaut false. Les exemples n’activent donc pas les paiements.

## Conflicts & Open Questions

- Les plateformes ne documentent pas exactement le même produit ni le même niveau d’accès ; comparer les pratiques éditoriales et de fiabilité sans considérer les fonctions métier comme équivalentes.
- Paystack reste non vérifié car son site renvoie HTTP 403 ; ce n’est pas une preuve d’absence de documentation ou de fonctionnalité.
- Les docs fournisseur sont des sources de première partie, fiables pour décrire leur propre documentation, mais pas des sources neutres de comparaison de marché.
- Les recherches d’actualité des quatre entités n’ont pas retourné de mise à jour de documentation pertinente et vérifiable ; aucune statistique de marché ou annonce non pertinente ne sera utilisée.

## Gaps

- Paystack : consultation directe impossible ; exclu des comparaisons de contrat.
- Aucune exécution des exemples n’a été faite contre une API de paiement réelle ; l’étude ne prouve pas la disponibilité opérationnelle des environnements fournisseurs ou SendFlow.
