import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight, BookOpen, Check, ChevronRight,
  Code2, Copy, FileCode2, Globe2, LifeBuoy, LockKeyhole, Menu, Search, ShieldCheck,
  Webhook, X,
} from 'lucide-react';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import apiIntegrationIllustration from '../assets/docs-api-integration-3d.webp';
import hostedCheckoutIllustration from '../assets/docs-hosted-checkout-3d.webp';
import { useSeo } from '@/lib/seo';
import { getDocsCodeExample, type DocsCodeFormat, type DocsExampleId } from './docs-code-examples';
import './docs.css';

type Language = 'fr' | 'en';
type DocGroup = 'start' | 'checkout' | 'integration' | 'directApi' | 'reference';
type DocItem = { path: string; key: string; label: string; group: DocGroup; icon: typeof BookOpen };
type Translation = Record<string, string>;
type TranslationLists = {
  stepTitles: string[];
  stepTexts: string[];
  responsibilitiesText: string[];
};

const docsItems: DocItem[] = [
  { path: '/docs', key: 'home', label: 'Documentation', group: 'start', icon: BookOpen },
  { path: '/docs/getting-started', key: 'start', label: 'Getting started', group: 'start', icon: ArrowRight },
  { path: '/docs/authentication', key: 'auth', label: 'Authentication', group: 'start', icon: LockKeyhole },
  { path: '/docs/integrations/hosted', key: 'hosted', label: 'Hosted redirect', group: 'checkout', icon: Globe2 },
  { path: '/docs/integrations/direct', key: 'direct', label: 'Direct integration', group: 'integration', icon: Code2 },
  { path: '/docs/api-reference', key: 'api', label: 'API reference', group: 'directApi', icon: FileCode2 },
  { path: '/docs/webhooks', key: 'webhooks', label: 'Webhooks', group: 'directApi', icon: Webhook },
  { path: '/docs/reference', key: 'reference', label: 'Errors & security', group: 'reference', icon: ShieldCheck },
];

const docGroups: { id: DocGroup; labelKey: string; icon: typeof BookOpen }[] = [
  { id: 'start', labelKey: 'startGroup', icon: BookOpen },
  { id: 'checkout', labelKey: 'checkoutGroup', icon: Globe2 },
  { id: 'integration', labelKey: 'integrations', icon: Code2 },
  { id: 'directApi', labelKey: 'directApi', icon: FileCode2 },
  { id: 'reference', labelKey: 'reference', icon: ShieldCheck },
];

const localized: Record<Language, Translation> = {
  fr: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'Référence API', navWebhooks: 'Webhooks',
    search: 'Rechercher dans la documentation…', menuClose: 'Fermer le menu', startGroup: 'Démarrer',
    checkoutGroup: 'Checkout', integrations: 'Intégration', directApi: 'API directe',
    reference: 'Référence', resources: 'Ressources', noResults: 'Aucun document ne correspond à cette recherche.',
    home: 'Documentation', start: 'Bien démarrer', auth: 'Authentification', direct: 'Intégration directe',
    hosted: 'Redirection hébergée', api: 'Référence API', webhooks: 'Webhooks', ref: 'Erreurs et sécurité',
    badge: 'API REST · JSON', prod: 'Documentation API SendFlow',
    homeTitle: 'Intégrez SendFlow à votre plateforme',
    homeSub: 'Découvrez les outils et les API nécessaires pour accepter les paiements avec SendFlow.',
    startTitle: 'Bien démarrer', startSub: 'Préparez vos accès, choisissez votre parcours et vérifiez chaque paiement depuis votre serveur.',
    authTitle: 'Authentification', authSub: 'Utilisez la clé secrète pour les appels serveur et la clé publique uniquement dans le parcours de caisse.',
    directTitle: 'Intégration API directe', directSub: 'Créez une session côté serveur, affichez les choix disponibles, puis suivez le statut confirmé par SendFlow.',
    hostedTitle: 'Paiement par redirection', hostedSub: 'Créez une session hébergée et redirigez le payeur vers le chemin de paiement SendFlow retourné par l’API.',
    apiTitle: 'Référence API', apiSub: 'Endpoints REST disponibles, paramètres, authentification, limites et réponses du contrat SendFlow.',
    webhooksTitle: 'Webhooks', webhooksSub: 'Configurez les notifications de paiement, vérifiez leur signature et traitez les livraisons répétées sans doublon.',
    refTitle: 'Erreurs, idempotence et sécurité', refSub: 'Réponses HTTP, durées, plafonds de requêtes et règles essentielles pour intégrer les paiements de façon fiable.',
    breadcrumb: 'Documentation API', methods: 'Choisissez votre méthode', methodsSub: 'Les deux parcours utilisent des sessions SendFlow et la même confirmation serveur du paiement.',
    directCard: 'API directe', directCardSub: 'Votre serveur contrôle le parcours et orchestre l’expérience dans votre application.',
    hostedCard: 'Paiement hébergé', hostedCardSub: 'Votre serveur crée la session, puis redirige le client vers le parcours de paiement SendFlow.',
    methodLevel: 'Niveau', methodControl: 'Contrôle du parcours', methodIntegration: 'Intégration', methodAuth: 'Authentification', methodReturn: 'Retour du paiement',
    developerLevel: 'Développeur', simpleLevel: 'Simple', highControl: 'Élevé', hostedControl: 'Limité à la page hébergée',
    restApi: 'API REST', sessionRedirect: 'Création de session puis redirection',
    authContract: 'Clé secrète côté serveur', returnToConfirm: 'Retour navigateur non probant',
    directGuide: 'Voir le guide API directe', hostedGuide: 'Voir le guide de redirection',
    capabilitiesTitle: 'Ce que l’intégration SendFlow prévoit',
    capabilitySession: 'Créer une session de paiement depuis votre serveur marchand.',
    capabilityCheckout: 'Présenter un parcours hébergé SendFlow au payeur.',
    capabilityStatus: 'Consulter le statut d’une session et d’une tentative.',
    capabilityWebhook: 'Recevoir les notifications de paiement réussi ou échoué par webhook.',
    baseUrlTitle: 'URL de base API',
    baseUrlPending: 'Préfixe des endpoints : /api. Configurez SENDFLOW_API_BASE_URL avec l’hôte API communiqué à votre compte, suivi de /api.',
    threeSteps: 'En 3 étapes', stepOne: 'Créez votre compte marchand', stepOneSub: 'Un compte marchand actif est requis pour générer et utiliser les clés API.', stepTwo: 'Configurez vos clés API', stepTwoSub: 'Les clés sont créées pour le compte et gérées dans l’espace Développeurs.', stepThree: 'Intégrez SendFlow à votre application', stepThreeSub: 'Créez la session côté serveur et vérifiez le résultat auprès de SendFlow.',
    read: 'Lire le guide', support: 'Besoin d’aide ?', supportSub: 'Contactez l’équipe SendFlow pour toute question liée à votre intégration.', contact: 'Contacter le support',
    disclaimerTitle: 'Confirmation du paiement', disclaimer: 'Ne marquez jamais une commande comme payée sur la seule base d’une redirection ou d’un état affiché dans le navigateur. Vérifiez le statut serveur ou traitez un webhook dont la signature est valide.',
    whatIs: 'Fonctionnement', whatIsText: 'SendFlow crée une session de paiement fixe en XOF, renvoie les informations nécessaires au parcours choisi, puis expose un statut de paiement vérifié côté serveur.',
    prerequisites: 'Prérequis', noCredentials: 'Ne placez jamais la clé secrète dans le navigateur, une application mobile distribuée, un dépôt public ou des journaux.',
    notDocumented: 'Gestion des clés API', notDocumentedText: 'Une paire composée d’une clé publique et d’une clé secrète est créée pour le compte marchand. La clé secrète est réservée aux appels serveur ; la clé publique sert aux appels de caisse prévus par le parcours direct.',
    rotationText: 'La clé secrète complète est affichée lors de sa création. Enregistrez-la dans un gestionnaire de secrets. La régénération désactive immédiatement l’ancienne paire de clés.',
    serverOnly: 'Envoyez la clé secrète dans l’en-tête Authorization: Bearer depuis votre serveur. Ne la transmettez jamais au client.',
    codeLabel: 'Exemple de requête', placeholder: 'Requête API', codeNote: 'Les valeurs entre chevrons ou dans les variables d’environnement sont à remplacer par les valeurs de votre compte.',
    model: 'Parcours de paiement', modelTextDirect: 'Créez la session avec mode direct depuis votre serveur. Le client lit ensuite la session publique, affiche les pays et opérateurs disponibles, lance une tentative pour le montant fixe, puis suit le statut.',
    modelTextHosted: 'Créez la session avec mode hosted depuis votre serveur. L’API renvoie checkoutPath ; combinez-le avec l’origine de paiement SendFlow communiquée pour votre compte et redirigez le client.',
    responsibilities: 'Règles d’intégration',
    endpointStatus: 'API REST · JSON',
    endpointCreate: 'Créer une session de paiement', endpointRead: 'Consulter une session et son état',
    endpointChoices: 'Lire la session publique et les choix disponibles (mode direct)',
    endpointAttempt: 'Créer une tentative de paiement directe', endpointAttemptRead: 'Consulter le statut d’une tentative',
    accessServerSecret: 'Serveur marchand · clé secrète et clé d’idempotence',
    accessServerSecretRead: 'Serveur marchand · clé secrète',
    accessPublicSession: 'Caisse · clé publique et jeton de session',
    accessPublicAttempt: 'Caisse · clé publique, jeton de session et clé d’idempotence',
    accessAttemptRead: 'Caisse · clés publique et de session, jeton de tentative',
    endpointPricing: 'Consulter les pays, opérateurs et frais publics',
    accessPublic: 'Public · aucune clé requise',
    endpointAccess: 'Authentification',
    availableChoicesNote: 'GET /api/pricing renvoie le catalogue public et les taux configurés. Les choix réellement proposés à un payeur sont également filtrés pour chaque session.',
    referenceIntro: 'Les exemples ci-dessous correspondent aux routes et schémas présents dans l’API SendFlow.',
    requestExample: 'Exemple de requête',
    responseExample: 'Exemple de réponse',
    webhookEvents: 'Événements de paiement', webhookEventsSub: 'Configurez une URL HTTPS et les types d’événements dans l’espace Développeurs. Jusqu’à 5 webhooks actifs peuvent être configurés pour un compte.',
    eventNames: 'Événements disponibles', delivery: 'Signature et livraisons', deliveryText: 'Chaque requête porte une signature HMAC-SHA256 sur l’horodatage et le corps JSON brut. SendFlow attend une réponse HTTP 2xx. Les échecs sont retentés jusqu’à 8 fois, avec des délais de 10 s, 30 s, 2 min, 10 min, 30 min, 2 h et 12 h. Dédupliquez avec sendflow-delivery, stable entre les tentatives.',
    security: 'Sécurité et fiabilité', errors: 'Codes HTTP', idempotency: 'Idempotence', expiration: 'Expiration et montants', securityText: 'Utilisez HTTPS. Stockez la clé secrète et le secret webhook (affiché une seule fois à sa création) dans un coffre sécurisé. Comparez la signature en temps constant, vérifiez la fraîcheur de l’horodatage et ne traitez l’événement qu’après validation.',
    errorsText: 'Les réponses d’erreur utilisent le format JSON { "error": "…" }. Une redirection ou une réponse client ne confirme jamais le paiement : vérifiez toujours le statut côté serveur.',
    error400: '400 — paramètres, en-têtes ou données de paiement invalides.',
    error401: '401 — clé secrète absente, invalide ou révoquée.',
    error403: '403 — compte marchand ou accès au paiement non autorisé.',
    error404: '404 — session, tentative ou identifiants publics indisponibles.',
    error409: '409 — référence marchand déjà utilisée ou conflit d’idempotence.',
    error429: '429 — limite de requêtes atteinte ; Retry-After indique le délai avant une nouvelle tentative.',
    error503: '503 — service de paiement ou de vérification momentanément indisponible.',
    idempotencyText: 'Envoyez une clé Idempotency-Key stable (8 à 128 caractères) pour chaque opération de création. Une répétition identique renvoie la même session ; la réutilisation avec une autre demande renvoie 409.',
    expirationText: 'Les sessions expirent une heure après leur création. Le montant est fixe en XOF : 100 à 2 000 000. Le payeur ne peut pas modifier le montant au lancement d’une tentative.',
    rateLimits: 'Limites de requêtes', rateLimitsText: 'Par clé API et par minute : 30 créations de session, 120 lectures de session, 5 tentatives directes et 60 vérifications de statut. En cas de limitation, l’API renvoie 429 et Retry-After: 60.',
    statesTitle: 'États d’un paiement', statesText: 'created : session créée, sans tentative. waiting : paiement en attente. uncertain : résultat encore indéterminé ; continuez la vérification et ne le traitez ni comme réussi ni comme échoué. succeeded : paiement confirmé. failed : échec final confirmé.',
    serviceAvailability: 'Disponibilité du service', serviceAvailabilityText: 'La création ou l’exécution d’un paiement peut répondre 403 ou 503 si le compte n’est pas autorisé ou si le service de confirmation n’est pas disponible. Une réponse 503 ne constitue jamais une preuve de paiement.',
    language: 'Langue', copyright: 'SendFlow · Documentation API', lastUpdated: 'Référence API v1',
    contents: 'Sommaire',
  },
  en: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'API reference', navWebhooks: 'Webhooks',
    search: 'Search documentation…', menuClose: 'Close menu', startGroup: 'Start here',
    checkoutGroup: 'Checkout', integrations: 'Integration', directApi: 'Direct API',
    reference: 'Reference', resources: 'Resources', noResults: 'No documents match your search.',
    home: 'Documentation', start: 'Getting started', auth: 'Authentication', direct: 'Direct integration',
    hosted: 'Hosted redirect', api: 'API reference', webhooks: 'Webhooks', ref: 'Errors & security',
    badge: 'REST API · JSON', prod: 'SendFlow API documentation',
    homeTitle: 'Integrate SendFlow with your platform',
    homeSub: 'Discover the tools and APIs you need to accept payments with SendFlow.',
    startTitle: 'Getting started', startSub: 'Set up your access, choose a payment flow, and verify each payment from your server.',
    authTitle: 'Authentication', authSub: 'Use the secret key for server requests and the public key only in the checkout flow.',
    directTitle: 'Direct API integration', directSub: 'Create a session server-side, display available choices, and follow the status confirmed by SendFlow.',
    hostedTitle: 'Hosted payment redirect', hostedSub: 'Create a hosted session and redirect the payer to the SendFlow payment path returned by the API.',
    apiTitle: 'API reference', apiSub: 'Available REST endpoints, parameters, authentication, limits, and SendFlow contract responses.',
    webhooksTitle: 'Webhooks', webhooksSub: 'Configure payment notifications, verify their signatures, and safely process repeated deliveries.',
    refTitle: 'Errors, idempotency & security', refSub: 'HTTP responses, session lifetimes, request limits, and essential rules for reliable payment integrations.',
    breadcrumb: 'API documentation', methods: 'Choose your integration method', methodsSub: 'Both flows use SendFlow sessions and the same server-confirmed payment status.',
    directCard: 'Direct API', directCardSub: 'Your server controls the flow and orchestrates the experience in your application.',
    hostedCard: 'Hosted payment', hostedCardSub: 'Your server creates a session, then redirects the customer to SendFlow checkout.',
    methodLevel: 'Level', methodControl: 'Flow control', methodIntegration: 'Integration', methodAuth: 'Authentication', methodReturn: 'Payment return',
    developerLevel: 'Developer', simpleLevel: 'Simple', highControl: 'High', hostedControl: 'Limited to hosted page',
    restApi: 'REST API', sessionRedirect: 'Create a session, then redirect',
    authContract: 'Server-side secret key', returnToConfirm: 'Browser redirect is not proof',
    directGuide: 'View the direct API guide', hostedGuide: 'View the redirect guide',
    capabilitiesTitle: 'What SendFlow integration covers',
    capabilitySession: 'Create a payment session from your merchant server.',
    capabilityCheckout: 'Present a SendFlow-hosted payment flow to the payer.',
    capabilityStatus: 'Read the status of a session and payment attempt.',
    capabilityWebhook: 'Receive successful or failed payment notifications by webhook.',
    baseUrlTitle: 'API base URL',
    baseUrlPending: 'Endpoint prefix: /api. Set SENDFLOW_API_BASE_URL to the API host provided for your account, followed by /api.',
    threeSteps: 'In 3 steps', stepOne: 'Create your merchant account', stepOneSub: 'An active merchant account is required to generate and use API keys.', stepTwo: 'Configure your API keys', stepTwoSub: 'Keys are created for the account and managed in the Developers area.', stepThree: 'Integrate SendFlow into your app', stepThreeSub: 'Create sessions server-side and verify results with SendFlow.',
    read: 'Read the guide', support: 'Need help?', supportSub: 'Contact the SendFlow team with questions about your integration.', contact: 'Contact support',
    disclaimerTitle: 'Payment confirmation', disclaimer: 'Never mark an order as paid based only on a redirect or a browser-side state. Verify the server status or process a webhook whose signature is valid.',
    whatIs: 'How it works', whatIsText: 'SendFlow creates a fixed XOF payment session, returns the information for the selected flow, and exposes a server-verified payment status.',
    prerequisites: 'Prerequisites', noCredentials: 'Never place the secret key in a browser, distributed mobile app, public repository, or client-side logs.',
    notDocumented: 'API key management', notDocumentedText: 'A public and secret key pair is created for the merchant account. The secret key is for server requests; the public key is used for checkout requests in the direct flow.',
    rotationText: 'The full secret key is shown when it is created. Store it in a secret manager. Regenerating the pair immediately disables the previous keys.',
    serverOnly: 'Send the secret key in the Authorization: Bearer header from your server. Never pass it to the client.',
    codeLabel: 'Request example', placeholder: 'API request', codeNote: 'Replace angle-bracket values and environment variables with values from your account.',
    model: 'Payment flow', modelTextDirect: 'Create the session with mode direct from your server. The client then reads the public session, displays available countries and operators, starts an attempt for the fixed amount, and polls its status.',
    modelTextHosted: 'Create the session with mode hosted from your server. The API returns checkoutPath; combine it with the SendFlow payment origin provided for your account and redirect the customer.',
    responsibilities: 'Integration rules',
    endpointStatus: 'REST API · JSON',
    endpointCreate: 'Create a payment session', endpointRead: 'Read a session and its status',
    endpointChoices: 'Read the public session and available choices (direct mode)',
    endpointAttempt: 'Create a direct payment attempt', endpointAttemptRead: 'Read an attempt status',
    accessServerSecret: 'Merchant server · secret key and idempotency key',
    accessServerSecretRead: 'Merchant server · secret key',
    accessPublicSession: 'Checkout · public key and session token',
    accessPublicAttempt: 'Checkout · public key, session token, and idempotency key',
    accessAttemptRead: 'Checkout · public and session keys, attempt token',
    endpointPricing: 'Read public countries, operators, and fees',
    accessPublic: 'Public · no key required',
    endpointAccess: 'Authentication',
    availableChoicesNote: 'GET /api/pricing returns the public catalog and configured rates. Choices shown to a payer are also filtered for each session.',
    referenceIntro: 'The examples below match routes and schemas present in the SendFlow API.',
    requestExample: 'Request example',
    responseExample: 'Response example',
    webhookEvents: 'Payment events', webhookEventsSub: 'Configure an HTTPS URL and event types in the merchant account Developers area. Up to 5 active webhook endpoints can be configured per account.',
    eventNames: 'Available events', delivery: 'Signatures and delivery', deliveryText: 'Each request includes an HMAC-SHA256 signature over the timestamp and raw JSON body. SendFlow expects an HTTP 2xx response. Failed deliveries are retried up to 8 times, after 10 s, 30 s, 2 min, 10 min, 30 min, 2 h, and 12 h. Deduplicate using sendflow-delivery, which stays stable across retries.',
    security: 'Security & reliability', errors: 'HTTP status codes', idempotency: 'Idempotency', expiration: 'Expiration and amounts', securityText: 'Use HTTPS. Store the secret key and webhook secret (shown once at creation) in a secure vault. Compare signatures in constant time, check timestamp freshness, and process events only after verification.',
    errorsText: 'Error responses use the JSON format { "error": "…" }. A redirect or client response never proves payment; always verify status server-side.',
    error400: '400 — invalid parameters, headers, or payment data.',
    error401: '401 — secret key missing, invalid, or revoked.',
    error403: '403 — merchant account or payment access is not authorized.',
    error404: '404 — session, attempt, or public credentials are unavailable.',
    error409: '409 — merchant reference already used or idempotency conflict.',
    error429: '429 — request limit reached; Retry-After tells you when to try again.',
    error503: '503 — payment or verification service temporarily unavailable.',
    idempotencyText: 'Send a stable Idempotency-Key (8–128 characters) for every create operation. An identical retry returns the same session; reuse with a different request returns 409.',
    expirationText: 'Sessions expire one hour after creation. The amount is fixed in XOF: 100 to 2,000,000. The payer cannot change it when starting an attempt.',
    rateLimits: 'Request limits', rateLimitsText: 'Per API key and per minute: 30 session creations, 120 session reads, 5 direct attempts, and 60 status checks. Rate-limited responses include 429 and Retry-After: 60.',
    statesTitle: 'Payment states', statesText: 'created: session created, no attempt yet. waiting: payment is pending. uncertain: outcome is not final; keep checking and do not treat it as paid or failed. succeeded: payment confirmed. failed: final failure confirmed.',
    serviceAvailability: 'Service availability', serviceAvailabilityText: 'Payment creation or execution can return 403 or 503 if the account is not eligible or the confirmation service is unavailable. A 503 response is never proof of payment.',
    language: 'Language', copyright: 'SendFlow · API documentation', lastUpdated: 'API reference v1',
    contents: 'Contents',
  },
};

const localizedLists: Record<Language, TranslationLists> = {
  fr: {
    stepTitles: ['Créez votre compte marchand', 'Configurez vos clés API', 'Intégrez SendFlow à votre application'],
    stepTexts: ['Créez votre compte marchand SendFlow.', 'Les clés sont créées automatiquement et se gèrent dans l’espace Développeurs.', 'Créez les sessions côté serveur et vérifiez chaque résultat auprès de SendFlow.'],
    responsibilitiesText: ['Gardez la clé secrète sur votre serveur ; le navigateur utilise uniquement les identifiants publics de session.', 'Traitez les événements de webhook de façon idempotente et validez leur signature HMAC.', 'Ne confirmez une commande qu’après un statut succeeded renvoyé par l’API ou un webhook authentique.'],
  },
  en: {
    stepTitles: ['Create your merchant account', 'Configure your API keys', 'Integrate SendFlow into your app'],
    stepTexts: ['Create your SendFlow merchant account.', 'Keys are created automatically and managed in the Developers area.', 'Create sessions server-side and verify each result with SendFlow.'],
    responsibilitiesText: ['Keep the secret key on your server; the browser uses only public session credentials.', 'Process webhook events idempotently and verify their HMAC signature.', 'Confirm an order only after the API returns succeeded or an authentic webhook is received.'],
  },
};

const pageKeys: Record<string, string> = {
  '/docs': 'home', '/docs/getting-started': 'start', '/docs/authentication': 'auth',
  '/docs/integrations/direct': 'direct', '/docs/integrations/hosted': 'hosted',
  '/docs/api-reference': 'api', '/docs/webhooks': 'webhooks', '/docs/reference': 'ref',
};

const apiEndpointInventory = [
  {
    method: 'POST', path: '/api/v1/payment-sessions', description: 'endpointCreate', access: 'accessServerSecret', example: 'create-hosted',
    codesFr: 'HTTP : 201, 400, 401, 403, 409, 429, 503.',
    codesEn: 'HTTP: 201, 400, 401, 403, 409, 429, 503.',
    requirementsFr: 'En-têtes : Authorization: Bearer <clé secrète>, Idempotency-Key (8–128 caractères), Content-Type: application/json. Champs requis : merchantReference (1–128), amountMinor (100–2 000 000), currency=XOF, mode=hosted|direct. Facultatifs : description (240 caractères max), returnUrl (URI), metadata (8 Ko max). Expiration : 1 heure.',
    requirementsEn: 'Headers: Authorization: Bearer <secret key>, Idempotency-Key (8–128 characters), Content-Type: application/json. Required: merchantReference (1–128), amountMinor (100–2,000,000), currency=XOF, mode=hosted|direct. Optional: description (max 240 characters), returnUrl (URI), metadata (max 8 KB). Expires after 1 hour.',
    response: `{
  "id": "<session-uuid>",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": "/pay/<payment-token>",
  "clientToken": "<session-client-token>",
  "publicKey": "sfpk_live_<public-key>",
  "expiresAt": "<ISO-8601 timestamp>"
}`,
  },
  {
    method: 'GET', path: '/api/v1/payment-sessions/{sessionId}', description: 'endpointRead', access: 'accessServerSecretRead', example: 'read-session',
    codesFr: 'HTTP : 200, 401, 403, 404, 429, 503.',
    codesEn: 'HTTP: 200, 401, 403, 404, 429, 503.',
    requirementsFr: 'Paramètre de chemin : sessionId (UUID). En-tête : Authorization: Bearer <clé secrète>. États possibles : created, waiting, uncertain, succeeded, failed.',
    requirementsEn: 'Path parameter: sessionId (UUID). Header: Authorization: Bearer <secret key>. Possible states: created, waiting, uncertain, succeeded, failed.',
    response: `{
  "id": "<session-uuid>",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "succeeded",
  "amountMinor": 12500,
  "currency": "XOF",
  "attemptId": "<attempt-uuid>",
  "createdAt": "<ISO-8601 timestamp>",
  "expiresAt": "<ISO-8601 timestamp>"
}`,
  },
  {
    method: 'GET', path: '/api/v1/public/payment-sessions/{sessionId}', description: 'endpointChoices', access: 'accessPublicSession', example: 'read-public-session',
    codesFr: 'HTTP : 200, 404, 429.',
    codesEn: 'HTTP: 200, 404, 429.',
    requirementsFr: 'Réservé aux sessions mode=direct. Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key et X-SendFlow-Client-Token.',
    requirementsEn: 'For mode=direct sessions only. Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key and X-SendFlow-Client-Token.',
    response: `{
  "id": "<session-uuid>",
  "merchantName": "Boutique Exemple",
  "description": null,
  "mode": "direct",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "expiresAt": "<ISO-8601 timestamp>",
  "countries": [
    {
      "code": "CI",
      "name": "Côte d’Ivoire",
      "flag": "🇨🇮",
      "phonePrefix": "+225",
      "minPhoneDigits": 10,
      "maxPhoneDigits": 10,
      "operators": [{ "id": "<operator-id>", "name": "<operator-name>", "initials": "OP", "logoUrl": null }]
    }
  ]
}`,
  },
  {
    method: 'POST', path: '/api/v1/public/payment-sessions/{sessionId}/attempts', description: 'endpointAttempt', access: 'accessPublicAttempt', example: 'start-attempt',
    codesFr: 'HTTP : 201, 400, 404, 409, 429, 503.',
    codesEn: 'HTTP: 201, 400, 404, 409, 429, 503.',
    requirementsFr: 'Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128). Corps : firstName et lastName (1–80), countryCode (2 lettres majuscules), operatorId (1–80, pris dans la session), phoneNumber (6–20). Le montant est celui de la session.',
    requirementsEn: 'Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128). Body: firstName and lastName (1–80), countryCode (two uppercase letters), operatorId (1–80, from the session), phoneNumber (6–20). The session amount is fixed.',
    response: `{
  "id": "<session-uuid>",
  "attemptId": "<attempt-uuid>",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "<attempt-poll-token>",
  "merchantReference": "ORDER-2026-0042"
}`,
  },
  {
    method: 'GET', path: '/api/v1/public/payment-sessions/{sessionId}/attempts/{attemptId}', description: 'endpointAttemptRead', access: 'accessAttemptRead', example: 'poll-attempt',
    codesFr: 'HTTP : 200, 404, 429, 503.',
    codesEn: 'HTTP: 200, 404, 429, 503.',
    requirementsFr: 'Paramètres : sessionId et attemptId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token et X-LinkFlow-Attempt-Token (pollToken renvoyé au démarrage).',
    requirementsEn: 'Parameters: sessionId and attemptId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, and X-LinkFlow-Attempt-Token (the pollToken returned when the attempt starts).',
    response: `{
  "id": "<session-uuid>",
  "attemptId": "<attempt-uuid>",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "<attempt-poll-token>",
  "merchantReference": "ORDER-2026-0042"
}`,
  },
  {
    method: 'GET', path: '/api/pricing', description: 'endpointPricing', access: 'accessPublic', example: 'pricing',
    codesFr: 'HTTP : 200.',
    codesEn: 'HTTP: 200.',
    requirementsFr: 'Aucun en-tête d’authentification. fees.linkflow est un taux décimal (0,025 = 2,5 %) ; les taux non configurés sont omis.',
    requirementsEn: 'No authentication header. fees.linkflow is a decimal rate (0.025 = 2.5%); unconfigured rates are omitted.',
    response: `{
  "categories": [{
    "id": "linkflow",
    "label": "Paiement par lien LinkFlow",
    "shortLabel": "LinkFlow",
    "description": "Paiement via un lien LinkFlow"
  }],
  "countries": [{
    "id": "ci", "name": "Côte d’Ivoire", "dialCode": "+225", "initials": "CI",
    "flag": "🇨🇮", "enabled": true, "minPhoneDigits": 10, "maxPhoneDigits": 10,
    "operations": { "deposit": true, "interNetwork": true, "international": true }
  }],
  "operators": [{
    "id": "<operator-id>", "countryId": "ci", "name": "Opérateur Exemple",
    "shortName": "Exemple", "initials": "OP", "brand": "generic",
    "logoUrl": null, "requiresOtp": false, "otpCommand": null,
    "operations": { "deposit": true, "interNetwork": true, "international": true },
    "fees": { "linkflow": 0.025 }
  }]
}`,
  },
] as const;

const docSearchTerms: Record<string, string> = {
  '/docs': 'accueil home intégration paiements payment',
  '/docs/getting-started': 'prérequis compte marchand étapes getting started',
  '/docs/authentication': 'clé api publique secrète bearer authentification credentials',
  '/docs/integrations/direct': 'api directe session tentative paiement mobile money pays opérateurs montant statut',
  '/docs/integrations/hosted': 'redirection hébergée checkout page payment link',
  '/docs/api-reference': `${apiEndpointInventory.map((endpoint) => `${endpoint.method} ${endpoint.path} ${endpoint.description}`).join(' ')} frais LinkFlow pays opérateurs session tentative statut idempotence`,
  '/docs/webhooks': 'webhook événements notifications signature retries livraisons payment.succeeded payment.failed HMAC',
  '/docs/reference': 'erreurs idempotence expiration sécurité limites',
};

function renderHighlightedCode(source: string) {
  const parts = source.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?:\/\/|#).*|--[A-Za-z-]+|\$[A-Za-z_]\w*|\b(?:curl|const|let|var|await|async|function|if|throw|import|from|def|return|new|true|false|null|None)\b|\b\d+(?:\.\d+)?\b)/gm);
  return parts.map((part, index) => {
    if (!part) return null;
    let tokenClass = '';
    if (/^(["'`])/.test(part)) tokenClass = 'sf-docs-token-string';
    else if (/^(\/\/|#)/.test(part)) tokenClass = 'sf-docs-token-comment';
    else if (/^--/.test(part)) tokenClass = 'sf-docs-token-option';
    else if (/^\$/.test(part)) tokenClass = 'sf-docs-token-variable';
    else if (/^\d/.test(part)) tokenClass = 'sf-docs-token-number';
    else if (/^(curl|const|let|var|await|async|function|if|throw|import|from|def|return|new|true|false|null|None)$/.test(part)) tokenClass = 'sf-docs-token-keyword';
    return tokenClass ? <span className={tokenClass} key={index}>{part}</span> : part;
  });
}

function CodePanel({ language, label, example }: { language: Language; label: string; example: DocsExampleId }) {
  const [format, setFormat] = useState<DocsCodeFormat>('cURL');
  const [copied, setCopied] = useState(false);
  const copyText = getDocsCodeExample(example, format);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="sf-docs-code" data-testid="panel-code-example">
      <div className="sf-docs-code-head">
        <span className="sf-docs-code-label">{label}</span>
        <div className="sf-docs-code-tools">
          <div className="sf-docs-code-lang" role="group" aria-label={language === 'fr' ? 'Format du code' : 'Code format'}>
            {(['cURL', 'JavaScript', 'PHP', 'Python'] as const).map((option) => (
              <button key={option} type="button" className={format === option ? 'is-active' : ''} onClick={() => setFormat(option)} aria-pressed={format === option} data-testid={`button-code-language-${option.toLowerCase()}`}>{option}</button>
            ))}
          </div>
          <button type="button" className="sf-docs-copy" onClick={() => void copy()} data-testid="button-copy-code">
            {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}
          </button>
        </div>
      </div>
      <pre><code>{renderHighlightedCode(copyText)}</code></pre>
      <div className="sf-docs-code-note">{localized[language].codeNote} · {format}</div>
    </div>
  );
}

export default function DocsPage() {
  const [path] = useLocation();
  const [language, setLanguage] = useState<Language>('fr');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([...docGroups.map((group) => group.id), 'resources']));
  const pageKey = pageKeys[path] ?? 'home';
  const t = localized[language];
  const filteredItems = useMemo(() => docsItems.filter((item) =>
    `${localized[language][item.key] ?? item.label} ${item.label} ${docSearchTerms[item.path] ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [language, query]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sidebarOpen]);
  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };
  const titleKey = `${pageKey}Title`;
  const description = t[`${pageKey}Sub`] ?? t.homeSub;
  const title = t[titleKey] ?? t.homeTitle;

  useSeo({
    path,
    locale: language,
    title: `${title} · SendFlow`,
    description,
    robots: 'index,follow',
  });

  const sidebarGroups = docGroups.map((group) => ({
    key: group.labelKey,
    items: filteredItems.filter((item) => item.group === group.id),
  }));

  const renderHome = () => (
    <>
      <div className="sf-docs-eyebrow">SENDFLOW / API</div>
      <h1 className="sf-docs-title">{t.homeTitle}</h1>
      <p className="sf-docs-lede">{t.homeSub}</p>
      <section className="sf-docs-section sf-docs-home-methods">
        <h2>{t.methods}</h2><p>{t.methodsSub}</p>
        <div className="sf-docs-cards">
          <Link href="/docs/integrations/hosted" className="sf-docs-card sf-docs-card-link" data-testid="card-docs-hosted">
            <div className="sf-docs-card-art">
              <img
                src={hostedCheckoutIllustration}
                alt={language === 'fr' ? 'Illustration 3D d’un paiement sécurisé par téléphone' : '3D illustration of a secure mobile payment'}
                loading="lazy"
              />
            </div>
            <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Globe2 size={19} /></span><ArrowRight className="sf-docs-card-arrow" size={16} /></div>
            <h3>{t.hostedCard}</h3><p>{t.hostedCardSub}</p>
            <dl className="sf-docs-method-details">
              <div><dt>{t.methodLevel}</dt><dd>{t.simpleLevel}</dd></div>
              <div><dt>{t.methodControl}</dt><dd>{t.hostedControl}</dd></div>
              <div><dt>{t.methodIntegration}</dt><dd>{t.sessionRedirect}</dd></div>
              <div><dt>{t.methodReturn}</dt><dd>{t.returnToConfirm}</dd></div>
            </dl>
            <span className="sf-docs-card-cta">{t.hostedGuide}<ArrowRight size={13} /></span>
          </Link>
          <Link href="/docs/integrations/direct" className="sf-docs-card sf-docs-card-link" data-testid="card-docs-direct">
            <div className="sf-docs-card-art">
              <img
                src={apiIntegrationIllustration}
                alt={language === 'fr' ? 'Illustration 3D d’un développeur intégrant SendFlow' : '3D illustration of a developer integrating SendFlow'}
                loading="lazy"
              />
            </div>
            <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Code2 size={19} /></span><ArrowRight className="sf-docs-card-arrow" size={16} /></div>
            <h3>{t.directCard}</h3><p>{t.directCardSub}</p>
            <dl className="sf-docs-method-details">
              <div><dt>{t.methodLevel}</dt><dd>{t.developerLevel}</dd></div>
              <div><dt>{t.methodControl}</dt><dd>{t.highControl}</dd></div>
              <div><dt>{t.methodIntegration}</dt><dd>{t.restApi}</dd></div>
              <div><dt>{t.methodAuth}</dt><dd>{t.authContract}</dd></div>
            </dl>
            <span className="sf-docs-card-cta">{t.directGuide}<ArrowRight size={13} /></span>
          </Link>
        </div>
      </section>
      <div className="sf-docs-meta"><span className="sf-docs-status"><i className="sf-docs-status-dot" />{t.badge}</span><span>{t.prod}</span></div>
      <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
      <section className="sf-docs-section">
        <h2>{t.capabilitiesTitle}</h2>
        <ul className="sf-docs-list">
          <li>{t.capabilitySession}</li>
          <li>{t.capabilityCheckout}</li>
          <li>{t.capabilityStatus}</li>
          <li>{t.capabilityWebhook}</li>
        </ul>
        <div className="sf-docs-callout sf-docs-base-url">
          <strong>{t.baseUrlTitle}</strong>
          <span>{t.baseUrlPending}</span>
        </div>
      </section>
      <section className="sf-docs-section">
        <h2>{t.threeSteps}</h2>
        <div className="sf-docs-steps">
          {[['1', t.stepOne, t.stepOneSub, '/docs/integrations/direct'], ['2', t.stepTwo, t.stepTwoSub, '/docs/authentication'], ['3', t.stepThree, t.stepThreeSub, '/docs/reference']].map(([number, heading, text, href]) => (
            <div className="sf-docs-step" key={number}><span className="sf-docs-step-index">{number}</span><div><strong>{heading}</strong><p>{text}</p></div><Link href={href}>{t.read}<ArrowRight size={13} /></Link></div>
          ))}
        </div>
      </section>
      <section className="sf-docs-support">
        <div><h3>{t.support}</h3><p>{t.supportSub}</p></div>
        <a href="mailto:support@sendflow01.com" data-testid="link-docs-support"><LifeBuoy size={15} />{t.contact}</a>
      </section>
    </>
  );

  const renderDocument = () => {
    return (
      <>
        <div className="sf-docs-breadcrumb"><Link href="/docs">{t.breadcrumb}</Link><ChevronRight size={12} /><span>{t[pageKey] ?? t.home}</span></div>
        <div className="sf-docs-eyebrow">SENDFLOW / API</div>
        <h1 className="sf-docs-title">{title}</h1>
        <p className="sf-docs-lede">{description}</p>
        <div className="sf-docs-meta"><span className="sf-docs-status"><i className="sf-docs-status-dot" />{t.endpointStatus}</span></div>
        {pageKey === 'start' && <>
          <section className="sf-docs-section"><h2>{t.whatIs}</h2><p>{t.whatIsText}</p>
            <div className="sf-docs-steps">
              {localizedLists[language].stepTitles.map((heading, index) => <div className="sf-docs-step" key={heading}><span className="sf-docs-step-index">0{index + 1}</span><div><strong>{heading}</strong><p>{localizedLists[language].stepTexts[index]}</p></div></div>)}
            </div>
          </section>
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><ul className="sf-docs-list"><li>{t.notDocumentedText}</li><li>{t.noCredentials}</li><li>{t.baseUrlPending}</li></ul></section>
        </>}
        {pageKey === 'auth' && <>
          <section className="sf-docs-section"><h2>{t.notDocumented}</h2><p>{t.notDocumentedText}</p><p>{t.rotationText}</p><div className="sf-docs-callout">{t.serverOnly}</div>
            <CodePanel language={language} label={t.codeLabel} example="read-session" />
          </section>
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><ul className="sf-docs-list"><li>{t.noCredentials}</li><li>{t.idempotencyText}</li></ul></section>
        </>}
        {pageKey === 'direct' && <>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{t.modelTextDirect}</p>
            <CodePanel language={language} label={t.codeLabel} example="create-direct" />
            <CodePanel language={language} label={t.codeLabel} example="read-public-session" />
            <CodePanel language={language} label={t.codeLabel} example="start-attempt" />
            <CodePanel language={language} label={t.codeLabel} example="poll-attempt" />
          </section>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
        </>}
        {pageKey === 'hosted' && <>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{t.modelTextHosted}</p>
            <CodePanel language={language} label={t.codeLabel} example="create-hosted" />
            <CodePanel language={language} label={t.codeLabel} example="read-session" />
          </section>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
        </>}
        {pageKey === 'api' && <>
          <section className="sf-docs-section"><h2>{t.reference}</h2><p>{t.referenceIntro}</p>
            <div className="sf-docs-endpoints">
              {apiEndpointInventory.map((endpoint) => (
                <article className="sf-docs-endpoint" key={endpoint.path} data-testid={`endpoint-card-${endpoint.method.toLowerCase()}-${endpoint.path.split('/').at(-1)}`}>
                  <div className="sf-docs-endpoint-head">
                    <span className={`sf-docs-method-badge is-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                    <code>{endpoint.path}</code>
                    <span className="sf-docs-endpoint-pending">{t.endpointStatus}</span>
                  </div>
                  <p>{t[endpoint.description]}</p>
                  <div className="sf-docs-endpoint-access"><span>{t.endpointAccess}</span><strong>{t[endpoint.access]}</strong></div>
                  <p className="sf-docs-endpoint-requirements">{language === 'fr' ? endpoint.requirementsFr : endpoint.requirementsEn}</p>
                  <p className="sf-docs-endpoint-codes">{language === 'fr' ? endpoint.codesFr : endpoint.codesEn}</p>
                  <details className="sf-docs-endpoint-example">
                    <summary>{t.requestExample}</summary>
                    <CodePanel language={language} label={`${endpoint.method} ${endpoint.path}`} example={endpoint.example} />
                  </details>
                  <details className="sf-docs-endpoint-example">
                    <summary>{t.responseExample}</summary>
                    <pre className="sf-docs-response"><code>{endpoint.response}</code></pre>
                  </details>
                </article>
              ))}
            </div>
            <p className="sf-docs-endpoint-note">{t.availableChoicesNote}</p>
          </section>
        </>}
        {pageKey === 'webhooks' && <>
          <section className="sf-docs-section"><h2>{t.webhookEvents}</h2><p>{t.webhookEventsSub}</p>
            <div className="sf-docs-card" style={{ marginTop: 15 }}>
              <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Webhook size={18} /></span><span className="sf-docs-status">{t.endpointStatus}</span></div>
              <h3>{t.eventNames}</h3>
              <ul className="sf-docs-list"><li><code className="sf-docs-inline-code">payment.succeeded</code></li><li><code className="sf-docs-inline-code">payment.failed</code></li></ul>
            </div>
          </section>
          <section className="sf-docs-section"><h2>{t.delivery}</h2><p>{t.deliveryText}</p>
            <pre className="sf-docs-response"><code>{`{
  "id": "<stable-event-id>",
  "type": "payment.succeeded",
  "createdAt": "<ISO-8601 timestamp>",
  "data": {
    "sessionId": "<session-uuid>",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "<attempt-uuid>",
    "transactionId": "<transaction-uuid>",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "succeeded"
  }
}`}</code></pre>
            <CodePanel language={language} label={t.codeLabel} example="webhook" />
          </section>
        </>}
        {pageKey === 'ref' && <>
          <section className="sf-docs-section"><h2>{t.security}</h2><p>{t.securityText}</p></section>
          <section className="sf-docs-section"><h2>{t.errors}</h2><p>{t.errorsText}</p><ul className="sf-docs-list">
            <li>{t.error400}</li><li>{t.error401}</li><li>{t.error403}</li><li>{t.error404}</li>
            <li>{t.error409}</li><li>{t.error429}</li><li>{t.error503}</li>
          </ul></section>
          <section className="sf-docs-section"><h2>{t.statesTitle}</h2><p>{t.statesText}</p></section>
          <section className="sf-docs-section"><h2>{t.idempotency}</h2><p>{t.idempotencyText}</p></section>
          <section className="sf-docs-section"><h2>{t.expiration}</h2><p>{t.expirationText}</p></section>
          <section className="sf-docs-section"><h2>{t.rateLimits}</h2><p>{t.rateLimitsText}</p></section>
          <div className="sf-docs-callout"><strong>{t.serviceAvailability}.</strong> {t.serviceAvailabilityText}</div>
        </>}
      </>
    );
  };

  return (
    <div className="sf-docs">
      <header className="sf-docs-header">
        <button type="button" className="sf-docs-mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-expanded={sidebarOpen} aria-label={sidebarOpen ? t.menuClose : t.contents} data-testid="button-docs-mobile-nav">{sidebarOpen ? <X size={18} /> : <Menu size={18} />}</button>
        <Link href="/docs" className="sf-docs-brand" aria-label="SendFlow documentation" data-testid="link-docs-home">
          <span className="sf-docs-brand-mark"><img src={sendflowMark} alt="" /></span><img className="sf-docs-brand-word" src={sendflowWordmark} alt="SendFlow" />
        </Link>
        <nav className="sf-docs-nav" aria-label="Main navigation">
          <Link href="/docs" className={path === '/docs' ? 'is-active' : ''} data-testid="link-docs-top-home">{t.navDocs}</Link>
          <Link href="/docs/getting-started" className={path === '/docs/getting-started' ? 'is-active' : ''} data-testid="link-docs-top-guides">{t.navGuides}</Link>
          <Link href="/docs/api-reference" className={path === '/docs/api-reference' ? 'is-active' : ''} data-testid="link-docs-top-api">{t.navApi}</Link>
          <Link href="/docs/webhooks" className={path === '/docs/webhooks' ? 'is-active' : ''} data-testid="link-docs-top-webhooks">{t.navWebhooks}</Link>
        </nav>
        <div className="sf-docs-header-tools">
          <button type="button" className="sf-docs-mobile-search" onClick={() => setSidebarOpen(true)} aria-label={t.search} data-testid="button-docs-mobile-search"><Search size={18} /></button>
          <button type="button" className="sf-docs-lang" onClick={() => setLanguage((current) => current === 'fr' ? 'en' : 'fr')} aria-label={language === 'fr' ? 'Switch to English' : 'Passer en français'} data-testid="button-docs-language">{language === 'fr' ? 'EN' : 'FR'}</button>
        </div>
      </header>
      <div className="sf-docs-mobile-breadcrumb">
        <button type="button" className="sf-docs-mobile-crumb-menu" onClick={() => setSidebarOpen((open) => !open)} aria-expanded={sidebarOpen} aria-label={sidebarOpen ? t.menuClose : t.contents} data-testid="button-docs-mobile-crumb-menu">
          {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
        <span>{t.startGroup}</span><ChevronRight size={15} aria-hidden="true" />
        <span className="sf-docs-mobile-crumb-current">{t[pageKey] ?? t.home}</span>
      </div>
      <div className="sf-docs-shell">
        {sidebarOpen && <button type="button" className="sf-docs-mobile-backdrop" aria-label="Close documentation menu" onClick={() => setSidebarOpen(false)} data-testid="button-close-docs-sidebar" />}
        <aside className={`sf-docs-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label={language === 'fr' ? 'Navigation de la documentation' : 'Documentation navigation'}>
          <div className="sf-docs-drawer-head">
            <button type="button" className="sf-docs-drawer-close" onClick={() => setSidebarOpen(false)} aria-label={t.menuClose} data-testid="button-close-docs-drawer"><X size={18} /></button>
            <Link href="/docs" className="sf-docs-drawer-brand" onClick={() => setSidebarOpen(false)} aria-label="SendFlow documentation" data-testid="link-docs-drawer-brand">
              <img className="sf-docs-drawer-mark" src={sendflowMark} alt="" />
              <img className="sf-docs-drawer-word" src={sendflowWordmark} alt="SendFlow" />
            </Link>
            <button type="button" className="sf-docs-drawer-language" onClick={() => setLanguage((current) => current === 'fr' ? 'en' : 'fr')} aria-label={language === 'fr' ? 'Switch to English' : 'Passer en français'}>{language === 'fr' ? 'EN' : 'FR'}</button>
          </div>
          <label className="sf-docs-search">
            <Search size={15} aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} data-testid="input-docs-search" />
            <kbd>/</kbd>
          </label>
          {sidebarGroups.filter((group) => group.items.length > 0).map((group) => {
            const GroupIcon = docGroups.find((item) => item.labelKey === group.key)?.icon ?? BookOpen;
            const groupId = docGroups.find((item) => item.labelKey === group.key)?.id ?? group.key;
            const isOpen = openGroups.has(groupId) || Boolean(query.trim());
            return (
              <section className={`sf-docs-nav-group${isOpen ? ' is-open' : ''}${group.items.some((item) => item.path === path) ? ' is-active' : ''}`} key={group.key}>
                <button type="button" className="sf-docs-group-toggle" onClick={() => toggleGroup(groupId)} aria-expanded={isOpen} aria-controls={`docs-nav-${groupId}`} data-testid={`button-docs-group-${groupId}`}>
                  <GroupIcon size={15} aria-hidden="true" />
                  <span>{t[group.key]}</span>
                  <ChevronRight className="sf-docs-group-chevron" size={15} aria-hidden="true" />
                </button>
                <div className="sf-docs-nav-items" id={`docs-nav-${groupId}`} hidden={!isOpen}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return <Link href={item.path} key={item.path} onClick={() => setSidebarOpen(false)} className={`sf-docs-side-link${path === item.path ? ' is-active' : ''}`} aria-current={path === item.path ? 'page' : undefined} data-testid={`link-docs-${item.key}`}><Icon size={13} />{t[item.key] ?? item.label}</Link>;
                  })}
                </div>
              </section>
            );
          })}
          {query && filteredItems.length === 0 && <div className="sf-docs-search-empty">{t.noResults}</div>}
          {(!query || `${t.resources} ${t.contact} support contact`.toLowerCase().includes(query.trim().toLowerCase())) && <section className={`sf-docs-nav-group${openGroups.has('resources') || Boolean(query.trim()) ? ' is-open' : ''}`}>
            <button type="button" className="sf-docs-group-toggle" onClick={() => toggleGroup('resources')} aria-expanded={openGroups.has('resources') || Boolean(query.trim())} aria-controls="docs-nav-resources" data-testid="button-docs-group-resources">
              <LifeBuoy size={15} aria-hidden="true" /><span>{t.resources}</span><ChevronRight className="sf-docs-group-chevron" size={15} aria-hidden="true" />
            </button>
            <div className="sf-docs-nav-items" id="docs-nav-resources" hidden={!openGroups.has('resources') && !query.trim()}>
              <a className="sf-docs-side-link" href="mailto:support@sendflow01.com" data-testid="link-docs-sidebar-support"><LifeBuoy size={13} />{t.contact}</a>
            </div>
          </section>}
          <div className="sf-docs-sidebar-note"><ShieldCheck size={15} /><span>{t.prod}</span></div>
        </aside>
        <main className="sf-docs-main">
          <article className={`sf-docs-content${pageKey === 'home' ? ' sf-docs-home' : ''}`} key={`${path}-${language}`}>{pageKey === 'home' ? renderHome() : renderDocument()}</article>
          <footer className="sf-docs-footer">
            <span>{t.copyright} · {t.lastUpdated}</span>
            <div className="sf-docs-footer-links"><Link href="/docs/reference" data-testid="link-docs-footer-security">{t.security}</Link><Link href="/docs/webhooks" data-testid="link-docs-footer-webhooks">{t.navWebhooks}</Link><a href="mailto:support@sendflow01.com" data-testid="link-docs-footer-support">{t.contact}</a></div>
          </footer>
        </main>
      </div>
    </div>
  );
}
