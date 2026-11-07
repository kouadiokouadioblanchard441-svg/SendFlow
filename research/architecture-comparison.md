# Comparaison de l’architecture documentaire SendFlow

**Date de recherche :** 2026-11-07  
**Profondeur :** Standard  
**Sources consultées :** 20 URL publiques officielles ou vérifications d’accès

## Résumé exécutif

La documentation publique d’AshTechPay est accessible sans compte ; j’ai aussi lu des pages officielles de Stripe et Flutterwave. Leurs meilleurs points communs sont un parcours d’intégration explicite, des exemples proches de chaque étape, une séparation nette entre appels serveur et navigateur, puis une confirmation serveur du paiement. AshTechPay explique le parcours dans un guide rapide de bout en bout ; Stripe propose des guides de scénarios et une référence API distincte ; Flutterwave sépare notamment le test, la configuration, la validation du compte et le passage en production. [1](https://doc.ashtechpay.com/docs/quickstart) [2](https://docs.stripe.com/checkout/quickstart) [3](https://developer.flutterwave.com/docs/quickstart)

SendFlow possède déjà une base documentaire structurée : démarrage, authentification, intégrations directe et hébergée, référence d’API, webhooks, erreurs et sécurité. Les pages sont intégrées à l’application SendFlow et n’apparaissent que sur le domaine de documentation configuré. Les exemples couvrent plusieurs langages et détaillent les paramètres, réponses, états, limites et erreurs. La lacune la plus importante n’est pas la quantité de pages : le code actuel ferme encore la création de session et le démarrage de tentative avec HTTP 503 tant que le contrôle technique `LINKFLOW_SETTLEMENT_PROOF_READY` est à false. Les textes de disponibilité l’indiquent ; un guide ne peut pas rendre ce parcours opérationnel à lui seul. [4](https://doc.ashtechpay.com/docs/introduction) [5](https://doc.ashtechpay.com/docs/embedded-checkout) [6](https://docs.stripe.com/payments/accept-a-payment) [7](https://developer.flutterwave.com/docs/flutterwave-standard-1)

## Contexte et méthode

J’ai comparé la façon dont les docs accompagnent un intégrateur : comprendre les modes disponibles, préparer les accès, effectuer les requêtes, interpréter les réponses, traiter erreurs et webhooks, puis tester sans argent réel. Il s’agit d’une comparaison documentaire et d’architecture d’intégration, pas d’une comparaison des tarifs, de la couverture commerciale ou de la qualité des prestataires de paiement. Les sources sont les documentations officielles, donc elles sont directes pour décrire chaque produit, mais promotionnelles et non neutres pour classer les entreprises.

Les docs SendFlow ont été relues dans `artifacts/sendflow/src/pages/docs.tsx`, `artifacts/sendflow/src/pages/docs-code-examples.ts`, `artifacts/sendflow/src/lib/documentation-host.ts` et `lib/api-spec/openapi.yaml`. Je n’ai exécuté aucun paiement, consulté aucune donnée de production ou vérifié le serveur Plesk. Les appels des exemples n’ont pas été lancés contre les API des plateformes.

## Résultats principaux

### 1. Parcours développeur et organisation des guides

AshTechPay rend le parcours de démarrage particulièrement linéaire : prérequis, lecture du catalogue pays/opérateurs, lecture des frais, création d’une collecte, puis vérification de transaction. Chaque étape est accompagnée de code et le guide recommande de charger le catalogue plutôt que de coder les opérateurs en dur. Le guide hébergé ajoute ensuite un flux numéroté, les champs de requête, la réponse, la redirection, l’idempotence et la confirmation serveur. [4](https://doc.ashtechpay.com/docs/introduction) [1](https://doc.ashtechpay.com/docs/quickstart) [5](https://doc.ashtechpay.com/docs/embedded-checkout) [8](https://doc.ashtechpay.com/docs/direct-api/mobile-money)

Stripe ne force pas un seul parcours : ses docs orientent vers des intégrations hébergées ou intégrées, puis donnent un Quickstart complet pour créer une session côté serveur, rediriger le client et gérer le retour. Flutterwave découpe les méthodes de paiement et documente aussi les étapes de son flux Standard. Son Quickstart place le mode de test avant la configuration live et la validation KYC [9](https://developer.flutterwave.com/docs/authentication). Ce découpage est pertinent pour des intégrations qui n’ont pas les mêmes paramètres ; il évite de présenter tous les paiements comme un seul endpoint générique. [6](https://docs.stripe.com/payments/accept-a-payment) [2](https://docs.stripe.com/checkout/quickstart) [3](https://developer.flutterwave.com/docs/quickstart) [7](https://developer.flutterwave.com/docs/flutterwave-standard-1)

| Dimension | AshTechPay | Stripe | Flutterwave | SendFlow actuel |
|---|---|---|---|---|
| Démarrage | Catalogue, frais, création, statut | Guide de paiement hébergé ou intégré, puis exemple complet | Test, configuration, KYC, mise en production | Démarrage, authentification et parcours direct/hébergé séparés |
| Référence | Pages par fonction et guides spécialisés | Référence API à côté des guides de scénario | Guides par version, méthode et opération | Référence intégrée avec paramètres, accès, réponses et erreurs |
| Hébergement des docs | Portail public lié depuis la page d’introduction | Site de documentation dédié | Portail de documentation dédié | Page React dans le même artefact SendFlow, protégée par le nom d’hôte exact |

Le choix SendFlow de conserver la documentation dans le même artefact est cohérent avec un seul déploiement produit : les pages et le code peuvent évoluer ensemble, et le domaine dédié est filtré par le frontend. En contrepartie, la documentation dépend du build et du routage de l’application principale ; le domaine doit donc arriver avec le bon en-tête Host et les routes de l’artefact. Ce n’est pas un défaut en soi, mais c’est une dépendance opérationnelle à surveiller.

### 2. Exemples et référence de contrat

SendFlow couvre déjà plus de formats visibles que son guide de démarrage ne le laissait entendre : cURL, JavaScript, Node.js, PHP, Python et Kotlin sont proposés selon les exemples. Le guide montre maintenant les lectures de `/pricing` et `/payment-limits`, la création d’une session hébergée et la lecture de son statut. Les guides Direct et Hosted détaillent ensuite leurs séquences respectives. La référence publique répertorie les routes pay-in et leurs accès ; les captures de réponses et les paramètres facilitent la mise en œuvre. Cette couverture est comparable aux guides complets d’AshTechPay et de Flutterwave, sans qu’il soit nécessaire d’ajouter des fonctions de payout ou de crypto absentes du contrat SendFlow. [1](https://doc.ashtechpay.com/docs/quickstart) [2](https://docs.stripe.com/checkout/quickstart) [7](https://developer.flutterwave.com/docs/flutterwave-standard-1) [10](https://developer.flutterwave.com/docs/transaction-verification)

Le point à corriger est la source de vérité. La liste publique des endpoints est définie dans `docs.tsx`, les fragments de code dans `docs-code-examples.ts` et le contrat machine dans `lib/api-spec/openapi.yaml`. Cette spécification OpenAPI contient bien les sessions marchandes, mais elle décrit aussi des opérations d’administration internes. Il ne faut donc pas publier le YAML complet comme référence publique. La solution propre est une spécification publique réduite aux seules routes marchandes autorisées, puis des exemples et tableaux générés ou contrôlés à partir de cette version. Ainsi, le contrat ne diverge pas silencieusement entre code serveur, spécification et pages.

Aucun SDK marchand officiel n’est présent dans le projet inspecté ; l’exemple Kotlin est un appel REST, ce que la documentation précise. Il vaut mieux l’indiquer clairement plutôt que d’appeler les extraits des SDK. Les docs Stripe et Flutterwave montrent aussi que les exemples doivent être intégrés à un parcours et non déposés seuls : chaque extrait est relié à une action suivante, à une réponse ou à une vérification. [2](https://docs.stripe.com/checkout/quickstart) [7](https://developer.flutterwave.com/docs/flutterwave-standard-1)

### 3. Confirmation, erreurs, webhooks et tests

Les trois références consultées mettent l’accent sur la confirmation serveur. AshTechPay rappelle que le navigateur n’est pas une preuve de paiement et recommande statut ou webhook ; Stripe demande d’attendre le paiement confirmé avant de livrer, et détaille signature, doublons, ordre et reprises ; Flutterwave demande de vérifier la transaction après notification et documente le secret de webhook, le code HTTP de réponse et les tentatives de livraison. Les mécanismes exacts diffèrent d’un fournisseur à l’autre : SendFlow doit conserver son propre contrat HMAC et ses propres états, pas reprendre les en-têtes ou délais d’un autre système. [11](https://doc.ashtechpay.com/docs/direct-api/webhooks) [5](https://doc.ashtechpay.com/docs/embedded-checkout) [12](https://docs.stripe.com/webhooks) [13](https://developer.flutterwave.com/docs/webhooks) [10](https://developer.flutterwave.com/docs/transaction-verification)

SendFlow documente utilement la distinction entre clé secrète serveur, clé publique, jeton client et jeton de suivi ; il décrit l’idempotence, les états non finaux, les limites, la signature HMAC et la déduplication. Il indique aussi que les erreurs sont des enveloppes JSON sans code machine stable : les intégrateurs doivent se baser sur HTTP plutôt que sur le texte du message. Un champ d’erreur stable, tel qu’un `code` documenté séparément du texte, réduirait les traitements fragiles. Les docs AshTechPay et Stripe expliquent elles aussi les reprises et les clés idempotentes, mais leurs durées et règles sont propres à leurs API. [14](https://doc.ashtechpay.com/docs/authentication) [15](https://doc.ashtechpay.com/docs/errors) [16](https://docs.stripe.com/api/idempotent_requests) [12](https://docs.stripe.com/webhooks)

La lacune opérationnelle majeure est le test sûr. AshTechPay possède une page Sandbox avec scénarios simulés, et Stripe et Flutterwave distinguent le mode de test de la production. Dans SendFlow, la documentation publique n’expose pas de sandbox marchande équivalente ; de plus, le code inspecté bloque les créations et démarrages par 503 tant que la preuve technique de règlement n’est pas prête. Il faut conserver cet avertissement et ne pas ajouter un faux bouton ou un exemple qui déclencherait une transaction réelle. Une sandbox utile devra être isolée côté serveur et incapable de produire un paiement, une livraison fournisseur ou un webhook réel. [17](https://doc.ashtechpay.com/docs/sandbox) [18](https://docs.stripe.com/testing) [19](https://developer.flutterwave.com/docs/testing)

## Analyse

SendFlow n’a pas besoin de copier l’ampleur fonctionnelle des grandes plateformes. La bonne comparaison porte sur leur pédagogie : un intégrateur sait quoi configurer, quel appel effectuer, quelle réponse attendre, quoi afficher au payeur, comment reprendre une erreur et à quel moment livrer sa commande. AshTechPay illustre bien la progression rapide de premier appel ; Stripe sépare les scénarios de paiement, la référence et les tests ; Flutterwave rend visibles les étapes test/live et les pages spécialisées. SendFlow dispose déjà de presque toutes les sections de référence nécessaires et sa séparation entre secret serveur et identifiants limités du navigateur est adaptée à son modèle.

Le point plus faible est la cohérence automatisée. Une page peut décrire un chemin correct alors que l’exemple, la spécification ou la route évolue indépendamment. Puisque le dépôt possède un OpenAPI global mais qu’il contient aussi des routes internes, la meilleure architecture est un contrat public marchand distinct, explicitement autorisé, avec validation automatisée des extraits et des réponses documentées. Cela apporte le bénéfice d’une référence plus fiable sans exposer les chemins d’administration ni générer une documentation trop large.

La publication devrait aussi distinguer trois états que les lecteurs confondent facilement : contrat disponible, environnement de test disponible et paiements live activés. Aujourd’hui, le portail indique correctement le verrou 503 dans le code source, mais cette information est écrite dans le texte statique. Si le verrou ou le domaine change, le texte peut vieillir. Une indication de disponibilité liée à un état de déploiement vérifié, ou au minimum datée à chaque release, réduirait le risque de fausse attente. Cela ne doit jamais permettre au navigateur de décider qu’un paiement est autorisé.

Enfin, le domaine dédié est une bonne séparation de marque et d’accès, mais le contenu n’est pas isolé du cycle de release de l’application SendFlow. Il faut donc tester le domaine de documentation dans la validation du package et du routage Plesk, en plus du test des pages. L’analyse actuelle ne confirme ni DNS ni proxy ni disponibilité en production.

## Limites

Dix-neuf pages officielles AshTechPay, Stripe et Flutterwave ont été récupérées ; une URL Paystack a renvoyé HTTP 403 et un challenge Cloudflare, malgré des tentatives sur ses pages de paiement, transaction, webhooks et suffixes Markdown [20](https://paystack.com/docs/payments/accept-payments/). Je ne formule donc aucune conclusion sur Paystack. Les callbacks de recherche intégrés renvoyaient aussi 402, mais les pages citées ont été récupérées directement depuis les sites officiels. Toutes les sources documentaires sont de première partie et sont classées Tier 3 pour une comparaison inter-entreprises ; elles font autorité sur les propres guides de chaque plateforme, pas sur leur qualité de service. Aucun appel de paiement ni contrôle Plesk n’a été effectué.

## Recommandations prioritaires

1. **Garder la disponibilité explicite.** Tant que `LINKFLOW_SETTLEMENT_PROOF_READY` reste fermé, afficher l’avertissement 503 et présenter les exemples comme le contrat, pas comme un paiement activé. Ne retirer cette mention qu’après vérification serveur et preuve de disponibilité réelle.
2. **Créer un OpenAPI public marchand filtré.** N’inclure que les routes et schémas pay-in que SendFlow autorise aux marchands. Ne jamais publier l’OpenAPI monorepo complet, qui contient des opérations internes. Générer ou contrôler à partir de cette spécification les méthodes, champs, réponses et snippets de la documentation.
3. **Ajouter un environnement de test uniquement s’il est isolé.** Les clés, identités, stockage, livraisons et callbacks doivent être non-live côté serveur ; aucune valeur envoyée par le navigateur ne doit pouvoir basculer vers un paiement réel. Tant que ce dispositif n’existe pas, décrire clairement l’indisponibilité plutôt que d’inventer une sandbox.
4. **Stabiliser les erreurs machine.** Ajouter au contrat un code d’erreur stable séparé du message lisible, en gardant les statuts HTTP et les réponses 503 non finales. Tester les mêmes erreurs et limites dans la documentation française et anglaise.
5. **Conserver les guides par mode et compléter les suites de chaque étape.** Pour chaque parcours, garder exemple de requête, réponse, action suivante, lecture de statut et traitement webhook ; réserver les exemples de langages à ceux que l’équipe peut maintenir et valider.


## Sources

1. [AshTech Pay — Démarrage rapide](https://doc.ashtechpay.com/docs/quickstart) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-quickstart.md
2. [Stripe — Build a Stripe-hosted checkout page](https://docs.stripe.com/checkout/quickstart) — Publication date not stated; Tier 3. Evidence: research/sources/stripe-checkout-quickstart.md
3. [Flutterwave — Quickstart](https://developer.flutterwave.com/docs/quickstart) — Published 2026-10-19; Tier 3. Evidence: research/sources/flutterwave-quickstart.md
4. [AshTech Pay — Introduction](https://doc.ashtechpay.com/docs/introduction) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-introduction.md
5. [AshTech Pay — Hosted Checkout par redirection](https://doc.ashtechpay.com/docs/embedded-checkout) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-hosted-checkout.md
6. [Stripe — Accept a payment](https://docs.stripe.com/payments/accept-a-payment) — Publication date not stated; Tier 3. Evidence: research/sources/stripe-accept-payment.md
7. [Flutterwave — Standard checkout](https://developer.flutterwave.com/docs/flutterwave-standard-1) — Published 2026-10-19; Tier 3. Evidence: research/sources/flutterwave-standard-checkout.md
8. [AshTech Pay — Mobile Money](https://doc.ashtechpay.com/docs/direct-api/mobile-money) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-mobile-money.md
9. [Flutterwave — Authentication](https://developer.flutterwave.com/docs/authentication) — Published 2026-10-26; Tier 3. Evidence: research/sources/flutterwave-authentication.md
10. [Flutterwave — Transaction verification](https://developer.flutterwave.com/docs/transaction-verification) — Published 2026-10-19; Tier 3. Evidence: research/sources/flutterwave-transaction-verification.md
11. [AshTech Pay — Webhooks](https://doc.ashtechpay.com/docs/direct-api/webhooks) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-webhooks.md
12. [Stripe — Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks) — Publication date not stated; Tier 3. Evidence: research/sources/stripe-webhooks.md
13. [Flutterwave — Webhooks](https://developer.flutterwave.com/docs/webhooks) — Published 2026-10-19; Tier 3. Evidence: research/sources/flutterwave-webhooks.md
14. [AshTech Pay — Authentification](https://doc.ashtechpay.com/docs/authentication) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-authentication.md
15. [AshTech Pay — Erreurs et statuts HTTP](https://doc.ashtechpay.com/docs/errors) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-errors.md
16. [Stripe API — Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — Publication date not stated; Tier 3. Evidence: research/sources/stripe-idempotency.md
17. [AshTech Pay — Sandbox et tests](https://doc.ashtechpay.com/docs/sandbox) — Publication date not stated; Tier 3. Evidence: research/sources/ashtechpay-sandbox.md
18. [Stripe — Testing](https://docs.stripe.com/testing) — Publication date not stated; Tier 3. Evidence: research/sources/stripe-testing.md
19. [Flutterwave — Testing](https://developer.flutterwave.com/docs/testing) — Published 2026-10-19; Tier 3. Evidence: research/sources/flutterwave-testing.md
20. [Paystack public documentation access check](https://paystack.com/docs/payments/accept-payments/) — Published 2026-11-07; Tier 3. Evidence: research/sources/paystack-access-limitation.md
