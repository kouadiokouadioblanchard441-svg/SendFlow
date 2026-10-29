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
import { getDocsCodeExample, getDocsCodeFormats, type DocsCodeFormat, type DocsExampleId } from './docs-code-examples';
import './docs.css';

type Language = 'fr' | 'en';
type DocGroup = 'start' | 'checkout' | 'integration' | 'shared' | 'apiReference' | 'reference';
type DocItem = { path: string; key: string; label: string; group: DocGroup; icon: typeof BookOpen };
type Translation = Record<string, string>;
type TranslationLists = {
  stepTitles: string[];
  stepTexts: string[];
  responsibilitiesText: string[];
  directFlowTitles: string[];
  directFlowTexts: string[];
  hostedFlowTitles: string[];
  hostedFlowTexts: string[];
  mobileMoneyActors: { title: string; body: string }[];
  mobileMoneyCards: { title: string; status: string; body: string }[];
  troubleshooting: { symptom: string; action: string }[];
  credentialRows: { credential: string; usedFor: string; handling: string }[];
  paymentStateRows: { state: string; meaning: string; action: string }[];
};

const docsItems: DocItem[] = [
  { path: '/docs', key: 'home', label: 'Documentation', group: 'start', icon: BookOpen },
  { path: '/docs/getting-started', key: 'start', label: 'Getting started', group: 'start', icon: ArrowRight },
  { path: '/docs/authentication', key: 'auth', label: 'Authentication', group: 'start', icon: LockKeyhole },
  { path: '/docs/integrations/hosted', key: 'hosted', label: 'Hosted redirect', group: 'checkout', icon: Globe2 },
  { path: '/docs/integrations/direct', key: 'direct', label: 'Direct integration', group: 'integration', icon: Code2 },
  { path: '/docs/api-reference', key: 'api', label: 'API reference', group: 'apiReference', icon: FileCode2 },
  { path: '/docs/webhooks', key: 'webhooks', label: 'Webhooks', group: 'shared', icon: Webhook },
  { path: '/docs/reference', key: 'reference', label: 'Errors & security', group: 'reference', icon: ShieldCheck },
];

const docGroups: { id: DocGroup; labelKey: string; icon: typeof BookOpen }[] = [
  { id: 'start', labelKey: 'startGroup', icon: BookOpen },
  { id: 'checkout', labelKey: 'checkoutGroup', icon: Globe2 },
  { id: 'integration', labelKey: 'integrations', icon: Code2 },
  { id: 'shared', labelKey: 'sharedMethods', icon: Webhook },
  { id: 'apiReference', labelKey: 'apiReferenceGroup', icon: FileCode2 },
  { id: 'reference', labelKey: 'reference', icon: ShieldCheck },
];

const localized: Record<Language, Translation> = {
  fr: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'Référence API', navWebhooks: 'Webhooks',
    search: 'Rechercher dans la documentation…', menuClose: 'Fermer le menu', startGroup: 'Démarrer',
    checkoutGroup: 'Checkout', integrations: 'Intégration', sharedMethods: 'Commun aux deux',
    apiReferenceGroup: 'Référence API',
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
    baseUrlPending: 'Configurez SENDFLOW_API_BASE_URL avec l’origine API officielle communiquée par SendFlow, suivie de /api. Ne remplacez pas cet hôte par celui du portail de documentation.',
    threeSteps: 'En 3 étapes', stepOne: 'Créez votre compte marchand', stepOneSub: 'Un compte marchand actif et éligible est requis pour utiliser les paiements API.', stepTwo: 'Configurez vos clés API', stepTwoSub: 'Les clés sont créées pour le compte et gérées dans l’espace Développeurs.', stepThree: 'Intégrez SendFlow à votre application', stepThreeSub: 'Créez la session côté serveur et vérifiez le résultat auprès de SendFlow.',
    read: 'Lire le guide', support: 'Besoin d’aide ?', supportSub: 'Contactez l’équipe SendFlow pour toute question liée à votre intégration.', contact: 'Contacter le support',
    disclaimerTitle: 'Confirmation du paiement', disclaimer: 'Ne marquez jamais une commande comme payée sur la seule base d’une redirection ou d’un état affiché dans le navigateur. Vérifiez le statut serveur ou traitez un webhook dont la signature est valide.',
    whatIs: 'Fonctionnement', whatIsText: 'SendFlow crée une session de paiement fixe en XOF, renvoie les informations nécessaires au parcours choisi, puis expose un statut de paiement vérifié côté serveur.',
    prerequisites: 'Prérequis', noCredentials: 'Ne placez jamais la clé secrète dans le navigateur, une application mobile distribuée, un dépôt public ou des journaux.',
    notDocumented: 'Gestion des clés API', notDocumentedText: 'Une paire composée d’une clé publique et d’une clé secrète est créée automatiquement à la création du compte marchand. La clé secrète est réservée aux appels serveur ; la clé publique sert aux appels de caisse prévus par le parcours direct.',
    rotationText: 'La clé secrète complète est affichée lors de sa création. Enregistrez-la dans un gestionnaire de secrets. La régénération désactive immédiatement l’ancienne paire de clés.',
    serverOnly: 'Envoyez la clé secrète dans l’en-tête Authorization: Bearer depuis votre serveur. Ne la transmettez jamais au client.',
    credentialRolesTitle: 'Rôle et emplacement de chaque identifiant',
    credentialHeader: 'Identifiant', credentialUseHeader: 'Utilisation', credentialHandlingHeader: 'Protection',
    pollTokenNote: 'Le pollToken est un identifiant d’accès à la tentative. Préférez interroger l’état depuis votre serveur avec la clé secrète ; si le client doit le recevoir pour afficher la progression, gardez-le temporairement en mémoire et excluez-le des journaux, URL et outils analytiques.',
    codeLabel: 'Exemple de requête', placeholder: 'Requête API', codeNote: 'Extrait à intégrer à votre serveur ou à votre caisse : remplacez les variables d’environnement et les identifiants d’exemple par les valeurs obtenues aux étapes précédentes.',
    model: 'Parcours de paiement', modelTextDirect: 'Créez la session avec mode direct depuis votre serveur. Le client lit ensuite la session publique, affiche les pays et opérateurs disponibles, lance une tentative pour le montant fixe, puis suit le statut.',
    modelTextHosted: 'Créez la session avec mode hosted depuis votre serveur. L’API renvoie checkoutPath ; combinez-le avec l’origine de paiement SendFlow communiquée pour votre compte et redirigez le client.',
    apiAvailabilityTitle: 'Disponibilité actuelle',
    apiAvailabilityText: 'Dans le code inspecté, la création de sessions et le démarrage de tentatives ne sont pas activés : les requêtes admissibles renvoient HTTP 503. Les exemples décrivent le contrat, pas une disponibilité de production. Le routage de cette API ne couvre pas encore tous les agrégateurs configurables dans le panel ; utilisez uniquement les choix réellement renvoyés pour chaque session.',
    hostedOriginText: 'checkoutPath est un chemin relatif, pas une URL complète. Aucun domaine de paiement officiel n’est défini dans le code inspecté : demandez l’origine exacte à SendFlow et stockez-la dans SENDFLOW_CHECKOUT_ORIGIN. N’utilisez pas l’URL de la documentation.',
    hostedFallbackText: 'Si aucune returnUrl n’est fournie, le parcours hébergé redirige actuellement vers https://sendflow.africa après la confirmation succeeded. Cette redirection reste une indication d’interface, jamais une preuve de paiement.',
    webhookSharedNote: 'Les webhooks s’appliquent aux deux parcours, API directe et Hosted Checkout. Ils sont envoyés après un résultat final confirmé ; consultez le guide Webhooks pour vérifier la signature et dédupliquer les livraisons.',
    webhookGuideLink: 'Ouvrir le guide Webhooks',
    mobileMoneyTitle: 'Mobile Money, USSD et OTP',
    mobileMoneyText: 'Un démarrage de tentative peut renvoyer ussdCode ou null. Affichez uniquement la valeur réellement renvoyée ; ne codez pas de commande USSD en dur. Le catalogue /api/pricing peut exposer requiresOtp et otpCommand comme métadonnées, pas comme instructions universelles de paiement. Le parcours direct écarte actuellement les canaux signalés comme nécessitant un OTP et son corps n’accepte ni OTP ni PIN. Le secret API du marchand n’est pas le code opérateur du client : ne demandez jamais ce dernier et ne le transmettez pas à SendFlow.',
    mobileMoneyActorsTitle: 'Qui fait quoi dans le parcours Mobile Money ?',
    mobileMoneyCountryTitle: 'Notes par pays et opérateur',
    androidDirectNote: 'L’exemple Kotlin ci-dessous utilise les routes publiques de session directe depuis Android. Il s’agit d’un exemple REST, pas d’un SDK officiel ; il suppose kotlinx-coroutines-android. Créez la session sur votre serveur et transmettez seulement la clé publique et les jetons de session nécessaires.',
    directInputText: 'Attention au format : la session peut renvoyer un code pays en minuscules (par exemple ci), mais la création de tentative exige deux lettres majuscules (CI). Convertissez-le en majuscules. phoneNumber doit inclure l’indicatif international renvoyé par la session (par exemple +225 suivi du numéro national). Utilisez operatorId directement depuis la réponse de session.',
    hostedTimerText: 'La page hébergée affiche un compte à rebours d’attente de 10 minutes. Son expiration peut afficher une vue d’échec au payeur, mais ne prouve pas que le prestataire a confirmé un échec final : vérifiez l’état serveur ou le webhook et traitez uncertain comme non final.',
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
    availableChoicesNote: 'GET /api/pricing renvoie le catalogue public et les taux configurés, mais ne constitue pas un devis de frais ou de règlement par session et ne garantit pas qu’un opérateur puisse traiter un paiement API. Les réponses de session n’exposent pas le montant net marchand. Les choix de la session directe sont filtrés selon le routage et les règles actuellement pris en charge ; utilisez-les comme source de vérité.',
    referenceIntro: 'Les exemples ci-dessous correspondent aux routes et schémas présents dans l’API SendFlow.',
    requestExample: 'Exemple de requête',
    responseExample: 'Exemple de réponse',
    webhookEvents: 'Événements de paiement', webhookEventsSub: 'Les webhooks sont communs aux parcours API directe et Hosted Checkout pour les sessions créées par l’API. Configurez une URL HTTPS publique et les événements dans l’espace Développeurs ; aucun endpoint public de gestion de webhooks n’est documenté. Les événements ne sont émis qu’après confirmation finale. Jusqu’à 5 webhooks actifs peuvent être configurés pour un compte.',
    webhookPayloadNote: 'Le payload fournit des identifiants de session, tentative et transaction, la référence marchande, le montant, la devise et le statut. Son champ id est le même UUID que l’en-tête sendflow-delivery et reste stable lors des reprises. La référence marchande vient de votre requête : n’y placez pas de données personnelles.',
    eventNames: 'Événements disponibles', delivery: 'Signature et livraisons', deliveryText: 'La signature HMAC-SHA256 est calculée sur la chaîne <horodatage>.<corps JSON brut>. Répondez en HTTP 2xx pour acquitter la livraison ; toute réponse non-2xx, erreur réseau ou expiration du délai sera retentée. Le délai de requête est de 8 secondes et le corps de réponse est limité à 8 Ko. SendFlow effectue 8 tentatives au total au maximum : l’envoi initial puis jusqu’à 7 reprises, espacées de 10 s, 30 s, 2 min, 10 min, 30 min, 2 h et 12 h. L’identifiant sendflow-delivery reste stable entre les reprises : utilisez-le pour dédupliquer.',
    webhookHeadersTitle: 'En-têtes envoyés', webhookHeadersText: 'sendflow-event identifie le type d’événement. sendflow-delivery contient le même UUID que payload.id et reste identique lors des reprises. sendflow-signature suit le format t=<horodatage Unix>,v1=<signature hexadécimale>. La signature est calculée sur les octets exacts du corps reçu. L’exemple de vérification choisit une fenêtre de fraîcheur de 300 secondes à titre de politique marchande ; SendFlow ne fixe pas cette valeur.',
    apiScopeTitle: 'Périmètre de l’API publique', apiScopeText: 'Cette référence décrit les contrats de session, tentative directe, statut et tarification présents dans le code. Elle ne documente pas de route publique pour annuler un paiement, lister toutes les transactions, consulter un solde ou effectuer un retrait. Aucun SDK marchand officiel n’est présent dans le projet inspecté ; l’exemple Kotlin Android est un appel REST, pas un SDK SendFlow.',
    security: 'Sécurité et fiabilité', errors: 'Codes HTTP', idempotency: 'Idempotence', expiration: 'Expiration et montants', securityText: 'Utilisez HTTPS. Stockez la clé secrète et le secret webhook (affiché une seule fois à sa création) dans un coffre sécurisé. Comparez la signature en temps constant, vérifiez la fraîcheur de l’horodatage et ne traitez l’événement qu’après validation.',
    errorsText: 'Les réponses d’erreur utilisent le format JSON { "error": "…" }. Une réponse 503 indique une indisponibilité, pas un échec final du paiement. Une redirection ou un état affiché dans le navigateur ne confirme jamais le paiement : vérifiez toujours le statut côté serveur.',
    error400: '400 — paramètres ou en-têtes invalides. Vérifiez notamment currency=XOF, amountMinor, les champs requis, countryCode en deux majuscules et phoneNumber au format international.',
    error401: '401 — clé secrète absente, invalide ou révoquée. Vérifiez le secret côté serveur et l’en-tête Authorization: Bearer ; ne l’incluez jamais dans l’application cliente.',
    error403: '403 — compte marchand ou accès au paiement non autorisé. Vérifiez l’état et les droits du compte avant de réessayer.',
    error404: '404 — session, tentative ou identifiants publics introuvables. Réutilisez les identifiants renvoyés pour cette session et vérifiez qu’elle n’a pas expiré.',
    error409: '409 — référence marchand déjà utilisée ou clé Idempotency-Key réutilisée avec un corps différent. Pour une reprise, renvoyez la même requête avec la même clé ; une nouvelle opération métier reçoit une nouvelle clé.',
    error429: '429 — limite de requêtes atteinte. Respectez Retry-After: 60, ralentissez les vérifications de statut et ne relancez pas immédiatement.',
    error503: '503 — création ou traitement indisponible. Le code actuel renvoie ce statut pour les créations de session et tentatives admissibles ; ne le présentez pas comme un échec final du paiement.',
    idempotencyText: 'Pour chaque création de session ou de tentative, envoyez une clé Idempotency-Key stable de 8 à 128 caractères. Une reprise doit réutiliser la même clé et le même corps ; réutiliser la clé avec une autre demande renvoie 409. Utilisez une nouvelle clé uniquement pour une nouvelle opération métier.',
    expirationText: 'Les sessions expirent une heure après leur création. Le montant est fixe en XOF : 100 à 2 000 000. Le payeur ne peut pas modifier le montant au lancement d’une tentative.',
    rateLimits: 'Limites de requêtes', rateLimitsText: 'Par clé API et par minute : 30 créations de session, 120 lectures de session, 5 tentatives directes et 60 vérifications de statut. Les routes de caisse appliquent aussi une limite par adresse IP. En cas de limitation, l’API renvoie 429 et Retry-After: 60 ; attendez ce délai avant de reprendre.',
    statesTitle: 'États d’un paiement', statesText: 'Les états de session et de tentative décrivent l’avancement du paiement ; seul un état final confirmé peut déclencher la validation de votre commande.',
    serviceAvailability: 'Disponibilité du service', serviceAvailabilityText: 'Dans le code inspecté, les requêtes admissibles de création de session et de démarrage de tentative renvoient HTTP 503. Les exemples ne prouvent pas que le parcours soit activé en production. Les lectures de statut ne créent pas de paiement et ne remplacent jamais la confirmation finale.',
    environmentNote: 'Aucune URL publique d’environnement de test distincte n’est confirmée dans les routes et contrats inspectés. SENDFLOW_API_BASE_URL doit être fourni par SendFlow ; n’inventez pas de domaine de test et ne confondez pas le serveur de documentation avec l’API.',
    troubleshootingTitle: 'Diagnostic rapide',
    hostedFlow: 'Parcours de redirection', directFlow: 'Parcours API directe', returnUrlText: 'returnUrl est facultative, doit être une URL HTTPS et concerne le parcours hosted : la page de paiement ne redirige vers cette URL qu’après confirmation succeeded. En mode direct, la réponse de statut API ne fournit pas cette redirection ; votre application gère son propre écran après vérification serveur.',
    language: 'Langue', copyright: 'SendFlow · Documentation API', lastUpdated: 'Référence API v1',
    contents: 'Sommaire',
  },
  en: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'API reference', navWebhooks: 'Webhooks',
    search: 'Search documentation…', menuClose: 'Close menu', startGroup: 'Start here',
    checkoutGroup: 'Checkout', integrations: 'Integration', sharedMethods: 'Shared',
    apiReferenceGroup: 'API reference',
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
    baseUrlPending: 'Set SENDFLOW_API_BASE_URL to the official API origin provided by SendFlow, followed by /api. Do not substitute the documentation portal host.',
    threeSteps: 'In 3 steps', stepOne: 'Create your merchant account', stepOneSub: 'An active, eligible merchant account is required to use API payments.', stepTwo: 'Configure your API keys', stepTwoSub: 'Keys are created for the account and managed in the Developers area.', stepThree: 'Integrate SendFlow into your app', stepThreeSub: 'Create sessions server-side and verify results with SendFlow.',
    read: 'Read the guide', support: 'Need help?', supportSub: 'Contact the SendFlow team with questions about your integration.', contact: 'Contact support',
    disclaimerTitle: 'Payment confirmation', disclaimer: 'Never mark an order as paid based only on a redirect or a browser-side state. Verify the server status or process a webhook whose signature is valid.',
    whatIs: 'How it works', whatIsText: 'SendFlow creates a fixed XOF payment session, returns the information for the selected flow, and exposes a server-verified payment status.',
    prerequisites: 'Prerequisites', noCredentials: 'Never place the secret key in a browser, distributed mobile app, public repository, or client-side logs.',
    notDocumented: 'API key management', notDocumentedText: 'A public and secret key pair is created automatically when the merchant account is created. The secret key is for server requests; the public key is used for checkout requests in the direct flow.',
    rotationText: 'The full secret key is shown when it is created. Store it in a secret manager. Regenerating the pair immediately disables the previous keys.',
    serverOnly: 'Send the secret key in the Authorization: Bearer header from your server. Never pass it to the client.',
    credentialRolesTitle: 'Role and handling of each credential',
    credentialHeader: 'Credential', credentialUseHeader: 'Used for', credentialHandlingHeader: 'Handling',
    pollTokenNote: 'pollToken grants access to an attempt. Prefer checking status from your server with the secret key; if the client needs it to show progress, keep it in memory temporarily and exclude it from logs, URLs, and analytics.',
    codeLabel: 'Request example', placeholder: 'API request', codeNote: 'Snippet to integrate into your server or checkout: replace environment variables and sample identifiers with values returned by previous steps.',
    model: 'Payment flow', modelTextDirect: 'Create the session with mode direct from your server. The client then reads the public session, displays available countries and operators, starts an attempt for the fixed amount, and polls its status.',
    modelTextHosted: 'Create the session with mode hosted from your server. The API returns checkoutPath; combine it with the SendFlow payment origin provided for your account and redirect the customer.',
    apiAvailabilityTitle: 'Current availability',
    apiAvailabilityText: 'In the inspected code, session creation and payment-attempt start are not enabled: eligible requests return HTTP 503. The examples describe the contract, not production availability. This API route does not yet cover every aggregator configurable in the admin panel; use only the choices actually returned for each session.',
    hostedOriginText: 'checkoutPath is a relative path, not a complete URL. No official payment domain is defined in the inspected code: ask SendFlow for the exact origin and store it in SENDFLOW_CHECKOUT_ORIGIN. Do not use the documentation URL.',
    hostedFallbackText: 'If no returnUrl is provided, the hosted flow currently redirects to https://sendflow.africa after succeeded is confirmed. This redirect is a user-interface signal, never proof of payment.',
    webhookSharedNote: 'Webhooks apply to both Direct API and Hosted Checkout. They are sent after a confirmed final result; see the Webhooks guide to verify signatures and deduplicate deliveries.',
    webhookGuideLink: 'Open the Webhooks guide',
    mobileMoneyTitle: 'Mobile Money, USSD, and OTP',
    mobileMoneyText: 'Starting an attempt may return ussdCode or null. Display only the value actually returned; do not hardcode USSD commands. /api/pricing may expose requiresOtp and otpCommand as metadata, not universal payment instructions. The current direct connector excludes channels marked as requiring OTP, and its request body accepts neither OTP nor PIN. A merchant API secret is not the customer’s operator code: never ask for or send that code to SendFlow.',
    mobileMoneyActorsTitle: 'Who does what in a Mobile Money payment?',
    mobileMoneyCountryTitle: 'Country and operator notes',
    androidDirectNote: 'The Kotlin example below uses public direct-session routes from Android. It is a REST example, not an official SDK; it assumes kotlinx-coroutines-android. Create the session on your server and pass only the public key and required session tokens to the app.',
    directInputText: 'Mind the format: the session may return a lowercase country code (for example ci), while creating an attempt requires two uppercase letters (CI). Convert it to uppercase. phoneNumber must include the international prefix returned by the session (for example +225 followed by the national number). Use operatorId directly from the session response.',
    hostedTimerText: 'The hosted page displays a 10-minute waiting countdown. When it expires, the payer may see a failure screen, but that does not prove a final failure was confirmed by the payment provider: check the server status or webhook and treat uncertain as non-final.',
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
    availableChoicesNote: 'GET /api/pricing returns the public catalog and configured rates, but it is not a per-session fee or settlement quote and does not guarantee that an operator can process an API payment. Session responses do not expose the merchant net amount. Direct-session choices are filtered according to currently supported routing and rules; treat them as authoritative.',
    referenceIntro: 'The examples below match routes and schemas present in the SendFlow API.',
    requestExample: 'Request example',
    responseExample: 'Response example',
    webhookEvents: 'Payment events', webhookEventsSub: 'Webhooks are shared by Direct API and Hosted Checkout for API-created sessions. Configure a public HTTPS URL and event types in the merchant account Developers area; no public webhook-management endpoint is documented. Events are emitted only after final confirmation. Up to 5 active webhook endpoints can be configured per account.',
    webhookPayloadNote: 'The payload contains session, attempt, and transaction IDs, the merchant reference, amount, currency, and status. Its id field is the same UUID as the sendflow-delivery header and remains stable on retries. The merchant reference comes from your request: do not put personal data in it.',
    eventNames: 'Available events', delivery: 'Signatures and delivery', deliveryText: 'The HMAC-SHA256 signature is computed over the string <timestamp>.<raw JSON body>. Return HTTP 2xx to acknowledge delivery; non-2xx responses, network errors, and timeouts are retried. The request timeout is 8 seconds and response bodies are limited to 8 KB. SendFlow makes at most 8 attempts total: the initial delivery plus up to 7 retries, spaced 10 s, 30 s, 2 min, 10 min, 30 min, 2 h, and 12 h apart. The sendflow-delivery ID stays stable across retries; use it for deduplication.',
    webhookHeadersTitle: 'Request headers', webhookHeadersText: 'sendflow-event identifies the event type. sendflow-delivery contains the same UUID as payload.id and remains unchanged on retries. sendflow-signature follows t=<Unix timestamp>,v1=<hex signature>. The signature is computed over the exact received body bytes. The verification example chooses a 300-second freshness window as merchant policy; SendFlow does not set this value.',
    apiScopeTitle: 'Public API scope', apiScopeText: 'This reference describes the session, direct-attempt, status, and pricing contracts present in the inspected code. It does not document a public route to cancel a payment, list all transactions, read a balance, or create a payout. No official merchant SDK is present in the inspected project; the Android Kotlin sample is a REST call, not a SendFlow SDK.',
    security: 'Security & reliability', errors: 'HTTP status codes', idempotency: 'Idempotency', expiration: 'Expiration and amounts', securityText: 'Use HTTPS. Store the secret key and webhook secret (shown once at creation) in a secure vault. Compare signatures in constant time, check timestamp freshness, and process events only after verification.',
    errorsText: 'Error responses use the JSON format { "error": "…" }. A 503 response means the operation is unavailable, not that payment finally failed. A redirect or client-side state never proves payment; always verify status server-side.',
    error400: '400 — invalid parameters or headers. Check currency=XOF, amountMinor, required fields, a two-letter uppercase countryCode, and an international phoneNumber.',
    error401: '401 — secret key missing, invalid, or revoked. Check the server-side Bearer credential; never include the secret in a client app.',
    error403: '403 — merchant account or payment access is not authorized. Check account status and permissions before retrying.',
    error404: '404 — session, attempt, or public credentials not found. Reuse the identifiers returned for that session and check that it has not expired.',
    error409: '409 — merchant reference already used, or Idempotency-Key reused with a different body. For a retry, resend the same request with the same key; use a new key only for a new business operation.',
    error429: '429 — request limit reached. Respect Retry-After: 60, slow down status checks, and do not retry immediately.',
    error503: '503 — session creation or payment processing is unavailable. The current code returns this status for eligible session and attempt creation; it is not a final payment failure.',
    idempotencyText: 'For each session or attempt creation, send a stable 8–128 character Idempotency-Key. A retry must reuse the same key and body; reusing the key with a different request returns 409. Use a new key only for a new business operation.',
    expirationText: 'Sessions expire one hour after creation. The amount is fixed in XOF: 100 to 2,000,000. The payer cannot change it when starting an attempt.',
    rateLimits: 'Request limits', rateLimitsText: 'Per API key and per minute: 30 session creations, 120 session reads, 5 direct attempts, and 60 status checks. Checkout routes also enforce an IP-based limit. A rate-limited response includes 429 and Retry-After: 60; wait before resuming.',
    statesTitle: 'Payment states', statesText: 'Session and attempt states describe payment progress; only a confirmed final state should trigger your order decision.',
    serviceAvailability: 'Service availability', serviceAvailabilityText: 'In the inspected code, eligible session-creation and attempt-start requests return HTTP 503. The examples do not mean the flow is enabled in production. Status reads do not create payments and never replace final confirmation.',
    environmentNote: 'No separate public test-environment URL is confirmed by the inspected routes and contracts. SendFlow must provide SENDFLOW_API_BASE_URL; do not invent a test domain or confuse the documentation host with the API.',
    troubleshootingTitle: 'Quick troubleshooting',
    hostedFlow: 'Hosted redirect flow', directFlow: 'Direct API flow', returnUrlText: 'returnUrl is optional, must be an HTTPS URL, and applies to hosted mode: the payment page redirects to it only after a succeeded confirmation. In direct mode, the API status response does not provide this redirect; your application handles its own result screen after server verification.',
    language: 'Language', copyright: 'SendFlow · API documentation', lastUpdated: 'API reference v1',
    contents: 'Contents',
  },
};

const localizedLists: Record<Language, TranslationLists> = {
  fr: {
    stepTitles: ['Créez votre compte marchand', 'Configurez vos clés API', 'Intégrez SendFlow à votre application'],
    stepTexts: ['Créez votre compte marchand SendFlow.', 'Les clés sont créées automatiquement et se gèrent dans l’espace Développeurs.', 'Créez les sessions côté serveur et vérifiez chaque résultat auprès de SendFlow.'],
    responsibilitiesText: ['Gardez la clé secrète sur votre serveur ; le navigateur utilise uniquement les identifiants publics de session.', 'Traitez les événements de webhook de façon idempotente et validez leur signature HMAC.', 'Ne confirmez une commande qu’après un statut succeeded renvoyé par l’API ou un webhook authentique.'],
    directFlowTitles: ['Créer la session', 'Charger les choix disponibles', 'Démarrer le paiement', 'Vérifier le résultat'],
    directFlowTexts: [
      'Marchand — depuis votre backend, créez une session en mode direct avec un montant XOF fixe et une clé Idempotency-Key stable. La clé secrète reste sur le serveur.',
      'Votre application de caisse lit la session publique avec publicKey et clientToken, puis affiche uniquement les pays et opérateurs renvoyés pour cette session.',
      'Le payeur choisit l’opérateur et saisit son numéro. La caisse envoie les champs demandés ; l’API renvoie une tentative, un état et éventuellement ussdCode. Le montant vient de la session et ne peut pas être changé.',
      'Le marchand suit la tentative avec pollToken ou lit la session avec sa clé secrète. Seul un état final succeeded confirmé valide la commande ; waiting et uncertain ne sont pas des succès.',
    ],
    hostedFlowTitles: ['Créer une session hébergée', 'Rediriger le client', 'Laisser le client payer', 'Confirmer côté serveur'],
    hostedFlowTexts: [
      'Marchand — votre backend crée la session avec mode=hosted, un montant fixe en XOF et une clé d’idempotence. Il reçoit checkoutPath.',
      'Votre serveur combine checkoutPath avec l’origine de paiement officielle communiquée par SendFlow, puis transmet l’URL complète au navigateur ou à l’application.',
      'Le payeur choisit un moyen proposé sur la page SendFlow et suit les instructions affichées par l’opérateur. Le retour navigateur ne confirme pas le paiement.',
      'Le serveur marchand relit la session et traite les webhooks communs aux deux modes. La page redirige vers returnUrl après succeeded ; seule la confirmation serveur valide la commande.',
    ],
    mobileMoneyActors: [
      { title: 'Client payeur', body: 'Choisit un pays et un opérateur renvoyés par la session, saisit son numéro et suit le code USSD effectivement fourni ou la notification de son opérateur. Il valide sur le parcours de l’opérateur ; l’application marchande ne doit pas collecter son OTP ou son PIN.' },
      { title: 'Marchand', body: 'Crée la session sur son serveur, affiche les choix disponibles, démarre la tentative et interroge son état. Il n’envoie jamais la clé secrète dans le navigateur ou l’application mobile.' },
      { title: 'Réponse de l’API', body: 'La tentative renvoie notamment attemptId, state, amount, currency, pollToken et un ussdCode qui peut être null. Le corps de création ne contient aucun champ OTP ou PIN.' },
      { title: 'Webhook', body: 'Pour les deux modes, SendFlow notifie payment.succeeded ou payment.failed uniquement après confirmation finale. Vérifiez la signature HMAC et dédupliquez avec sendflow-delivery.' },
    ],
    mobileMoneyCards: [
      { title: 'Côte d’Ivoire · Orange Money', status: 'Parcours à confirmer', body: 'Le code contient une métadonnée otpCommand associée à orange-ci, mais elle ne décrit pas un parcours de paiement complet et ne signifie pas que le mode direct accepte ce canal : le connecteur exclut les canaux marqués comme OTP requis. N’affichez aucune commande comme garantie ; vérifiez les choix de la session et le parcours opérateur avant publication.' },
      { title: 'Burkina Faso · Orange Money', status: 'Détails non confirmés', body: 'Aucun code USSD ni séquence OTP propre à ce pays n’est confirmé dans le contrat public inspecté. La disponibilité et les étapes propres à l’opérateur doivent être confirmées pour la session active. N’inventez pas d’étapes : utilisez uniquement un ussdCode réellement renvoyé ou les instructions de l’opérateur.' },
      { title: 'Autres pays et opérateurs', status: 'Choix dynamiques', body: 'Il n’existe pas de liste statique fiable à publier depuis le code seul. GET /api/pricing fournit un catalogue général, mais les choix de session directe sont filtrés par les règles de routage et de configuration ; ils font autorité pour cette session.' },
    ],
    troubleshooting: [
      { symptom: 'Aucun pays ou opérateur ne s’affiche', action: 'Vérifiez la réponse de la session directe. Le catalogue global de frais ne garantit pas qu’un opérateur soit admissible pour cette session.' },
      { symptom: 'Aucun code USSD n’est renvoyé', action: 'ussdCode peut être null. Ne fabriquez pas de code ; demandez au payeur de suivre la notification affichée par son opérateur.' },
      { symptom: 'Le client revient sans webhook', action: 'La redirection du navigateur n’est pas une confirmation. Lisez le statut serveur et consultez l’historique des livraisons webhook dans l’espace Développeurs.' },
      { symptom: 'Le compte à rebours hébergé expire', action: 'L’écran d’échec après 10 minutes n’est pas un état final serveur. Vérifiez la session et traitez uncertain comme non final.' },
      { symptom: 'Une création renvoie 503', action: 'Le parcours de création et de tentative est actuellement désactivé dans le code inspecté. N’essayez pas de contourner cette indisponibilité ni de présenter le paiement comme échoué ou réussi.' },
    ],
    credentialRows: [
      { credential: 'Clé secrète', usedFor: 'Authorization: Bearer pour créer et lire une session depuis le backend marchand.', handling: 'Serveur uniquement. Stockez-la dans un gestionnaire de secrets et ne la journalisez jamais.' },
      { credential: 'Clé publique', usedFor: 'X-SendFlow-Public-Key pour les appels de caisse du parcours direct.', handling: 'Peut être transmise au client dans le contexte de sa session ; elle ne remplace jamais la clé secrète.' },
      { credential: 'clientToken', usedFor: 'X-SendFlow-Client-Token pour lire la session directe et démarrer une tentative.', handling: 'Jeton limité à une session. Ne le partagez pas entre commandes et évitez de le conserver dans des journaux.' },
      { credential: 'pollToken', usedFor: 'X-LinkFlow-Attempt-Token pour consulter une tentative directe.', handling: 'Identifiant d’accès à une tentative. Préférez le suivi serveur et ne l’exposez que temporairement si l’interface en a besoin.' },
      { credential: 'Secret de signature webhook', usedFor: 'Vérifier les notifications reçues sur votre endpoint.', handling: 'Secret distinct des clés API, affiché une seule fois à la configuration ; conservez-le côté serveur.' },
    ],
    paymentStateRows: [
      { state: 'created', meaning: 'La session existe, aucune tentative n’a encore été lancée.', action: 'Poursuivez le parcours de caisse prévu pour son mode.' },
      { state: 'waiting', meaning: 'Une tentative est en attente de confirmation.', action: 'Continuez le suivi ; ne marquez pas la commande comme payée.' },
      { state: 'uncertain', meaning: 'Le résultat n’est pas confirmé et peut encore évoluer.', action: 'Ne classez ni comme réussi ni comme échoué ; relisez le statut et attendez le résultat serveur.' },
      { state: 'succeeded', meaning: 'Le paiement a été confirmé avec succès.', action: 'Vous pouvez valider la commande après vérification côté serveur.' },
      { state: 'failed', meaning: 'Un échec final a été confirmé.', action: 'Ne livrez pas la commande ; appliquez votre parcours de nouvel essai métier.' },
    ],
  },
  en: {
    stepTitles: ['Create your merchant account', 'Configure your API keys', 'Integrate SendFlow into your app'],
    stepTexts: ['Create your SendFlow merchant account.', 'Keys are created automatically and managed in the Developers area.', 'Create sessions server-side and verify each result with SendFlow.'],
    responsibilitiesText: ['Keep the secret key on your server; the browser uses only public session credentials.', 'Process webhook events idempotently and verify their HMAC signature.', 'Confirm an order only after the API returns succeeded or an authentic webhook is received.'],
    directFlowTitles: ['Create the session', 'Load available choices', 'Start the payment', 'Verify the result'],
    directFlowTexts: [
      'Merchant — create a direct-mode session on your backend with a fixed XOF amount and stable Idempotency-Key. Keep the secret key on the server.',
      'Your checkout reads the public session with publicKey and clientToken, then displays only the countries and operators returned for that session.',
      'The payer chooses an operator and enters a phone number. The checkout sends the required fields; the API returns an attempt, state, and possibly ussdCode. The session fixes the amount.',
      'The merchant polls the attempt with pollToken or reads the session with the secret key. Only a confirmed final succeeded state completes the order; waiting and uncertain are not success.',
    ],
    hostedFlowTitles: ['Create a hosted session', 'Redirect the customer', 'Let the customer pay', 'Verify server-side'],
    hostedFlowTexts: [
      'Merchant — your backend creates the session with mode=hosted, a fixed XOF amount, and an idempotency key. It receives checkoutPath.',
      'Your server combines checkoutPath with the official payment origin supplied by SendFlow, then passes the complete URL to the browser or app.',
      'The payer chooses a method on the SendFlow page and follows the operator instructions. A browser return does not confirm payment.',
      'The merchant server reads the session and processes webhooks shared by both modes. The page redirects to returnUrl after succeeded; only server confirmation completes the order.',
    ],
    mobileMoneyActors: [
      { title: 'Payer', body: 'Chooses a country and operator returned by the session, enters a phone number, and follows only the returned USSD code or the operator notification. Authorization happens in the operator flow; the merchant app must not collect the payer’s OTP or PIN.' },
      { title: 'Merchant', body: 'Creates the session on its server, displays available choices, starts the attempt, and checks its status. Never send the secret key to a browser or mobile app.' },
      { title: 'API response', body: 'The attempt returns, among other fields, attemptId, state, amount, currency, pollToken, and a possibly null ussdCode. The create-attempt body has no OTP or PIN field.' },
      { title: 'Webhook', body: 'For both modes, SendFlow sends payment.succeeded or payment.failed only after final confirmation. Verify the HMAC signature and deduplicate with sendflow-delivery.' },
    ],
    mobileMoneyCards: [
      { title: 'Côte d’Ivoire · Orange Money', status: 'Flow needs confirmation', body: 'The code contains otpCommand metadata associated with orange-ci, but it does not describe a complete payment flow or mean that Direct mode accepts that channel: the connector excludes channels marked as requiring OTP. Do not publish a command as guaranteed; verify the session choices and operator flow first.' },
      { title: 'Burkina Faso · Orange Money', status: 'Details unconfirmed', body: 'No USSD code or country-specific OTP sequence is confirmed in the inspected public contract. Availability and operator-specific steps must be confirmed for the active session. Do not invent steps: use only a ussdCode actually returned or the operator instructions.' },
      { title: 'Other countries and operators', status: 'Dynamic choices', body: 'The source alone does not provide a reliable static support list. GET /api/pricing returns a global catalog, but direct-session choices are filtered by routing and configuration rules and are authoritative for that session.' },
    ],
    troubleshooting: [
      { symptom: 'No country or operator is displayed', action: 'Check the direct session response. The global fee catalog does not guarantee that a method is eligible for this session.' },
      { symptom: 'No USSD code is returned', action: 'ussdCode may be null. Do not invent a code; ask the payer to follow the notification shown by the operator.' },
      { symptom: 'The customer returns but no webhook arrives', action: 'A browser redirect is not confirmation. Read the server status and check webhook delivery history in the Developers area.' },
      { symptom: 'The hosted countdown expires', action: 'The failure screen after 10 minutes is not a final server state. Check the session and treat uncertain as non-final.' },
      { symptom: 'A create request returns 503', action: 'Session and attempt creation are currently disabled in the inspected code. Do not work around this unavailability or label the payment as failed or successful.' },
    ],
    credentialRows: [
      { credential: 'Secret key', usedFor: 'Authorization: Bearer to create and read a session from the merchant backend.', handling: 'Server only. Store it in a secrets manager and never log it.' },
      { credential: 'Public key', usedFor: 'X-SendFlow-Public-Key for direct checkout requests.', handling: 'May be sent to the client for its session; it never replaces the secret key.' },
      { credential: 'clientToken', usedFor: 'X-SendFlow-Client-Token to read a direct session and start an attempt.', handling: 'Session-scoped token. Do not reuse across orders or place it in logs.' },
      { credential: 'pollToken', usedFor: 'X-LinkFlow-Attempt-Token to read a direct attempt.', handling: 'Attempt access credential. Prefer server-side polling; expose it only temporarily if the interface requires it.' },
      { credential: 'Webhook signing secret', usedFor: 'Verify notifications received by your endpoint.', handling: 'Separate from API keys and shown only once during setup; keep it server-side.' },
    ],
    paymentStateRows: [
      { state: 'created', meaning: 'The session exists; no attempt has started.', action: 'Continue with the checkout flow for its mode.' },
      { state: 'waiting', meaning: 'An attempt is awaiting confirmation.', action: 'Continue checking; do not mark the order as paid.' },
      { state: 'uncertain', meaning: 'The result is not confirmed and may still change.', action: 'Treat as neither success nor failure; re-read status and wait for server confirmation.' },
      { state: 'succeeded', meaning: 'Payment has been confirmed successfully.', action: 'You may fulfill the order after server-side verification.' },
      { state: 'failed', meaning: 'A final failure has been confirmed.', action: 'Do not fulfill the order; use your business retry flow.' },
    ],
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
    requirementsFr: 'En-têtes : Authorization: Bearer <clé secrète>, Idempotency-Key (8–128 caractères, sans espaces en début/fin), Content-Type: application/json. Requis : merchantReference (1–128), amountMinor (100–2 000 000), currency=XOF, mode=hosted|direct. Facultatifs : description (240 caractères max), returnUrl (URL HTTPS utilisée uniquement par le parcours hosted après confirmation succeeded), metadata (8 Ko max). Expiration : 1 heure.',
    requirementsEn: 'Headers: Authorization: Bearer <secret key>, Idempotency-Key (8–128 characters, no leading/trailing spaces), Content-Type: application/json. Required: merchantReference (1–128), amountMinor (100–2,000,000), currency=XOF, mode=hosted|direct. Optional: description (max 240 characters), returnUrl (HTTPS URL used only by hosted flow after succeeded confirmation), metadata (max 8 KB). Expires after 1 hour.',
    response: `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": "/pay/demo-payment-token",
  "clientToken": "<session-client-token-fictif>",
  "publicKey": "<public-key-fictive>",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`,
  },
  {
    method: 'GET', path: '/api/v1/payment-sessions/{sessionId}', description: 'endpointRead', access: 'accessServerSecretRead', example: 'read-session',
    codesFr: 'HTTP : 200, 401, 403, 404, 429, 503.',
    codesEn: 'HTTP: 200, 401, 403, 404, 429, 503.',
    requirementsFr: 'Paramètre de chemin : sessionId (UUID). En-tête : Authorization: Bearer <clé secrète>. États possibles : created, waiting, uncertain, succeeded, failed.',
    requirementsEn: 'Path parameter: sessionId (UUID). Header: Authorization: Bearer <secret key>. Possible states: created, waiting, uncertain, succeeded, failed.',
    response: `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "succeeded",
  "amountMinor": 12500,
  "currency": "XOF",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "createdAt": "2026-10-29T10:30:00.000Z",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`,
  },
  {
    method: 'GET', path: '/api/v1/public/payment-sessions/{sessionId}', description: 'endpointChoices', access: 'accessPublicSession', example: 'read-public-session',
    codesFr: 'HTTP : 200, 404, 429, 503.',
    codesEn: 'HTTP: 200, 404, 429, 503.',
    requirementsFr: 'Réservé aux sessions mode=direct. Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key et X-SendFlow-Client-Token.',
    requirementsEn: 'For mode=direct sessions only. Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key and X-SendFlow-Client-Token.',
    response: `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantName": "Boutique Exemple",
  "description": "Paiement ORDER-2026-0043",
  "mode": "direct",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "expiresAt": "2026-10-29T11:30:00.000Z",
  "countries": [
    {
      "code": "ci",
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
    requirementsFr: 'Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128). Corps : firstName et lastName (1–80), countryCode (2 lettres majuscules ; convertir le code de la session si nécessaire), operatorId (1–80, pris dans la session), phoneNumber (6–20 avec l’indicatif international phonePrefix). Le montant est celui de la session.',
    requirementsEn: 'Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128). Body: firstName and lastName (1–80), countryCode (two uppercase letters; convert the session value if needed), operatorId (1–80, from the session), phoneNumber (6–20 including the international phonePrefix). The session amount is fixed.',
    response: `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0042"
}`,
  },
  {
    method: 'GET', path: '/api/pricing', description: 'endpointPricing', access: 'accessPublic', example: 'pricing',
    codesFr: 'HTTP : 200, 503.',
    codesEn: 'HTTP: 200, 503.',
    requirementsFr: 'Aucun en-tête d’authentification. fees.linkflow est un taux décimal (0,025 signifie 2,5 %). Les taux non configurés sont omis ; les valeurs de l’exemple sont illustratives.',
    requirementsEn: 'No authentication header. fees.linkflow is a decimal rate (0.025 means 2.5%). Unconfigured rates are omitted; example values are illustrative.',
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
  '/docs/integrations/direct': 'api directe session tentative paiement mobile money pays opérateurs montant statut countryCode operatorId phoneNumber ussdCode OTP USSD Kotlin Côte d’Ivoire Burkina Faso Orange Money',
  '/docs/integrations/hosted': 'redirection hébergée checkout page payment link checkoutPath returnUrl compte à rebours client paiement Hosted Checkout',
  '/docs/api-reference': `${apiEndpointInventory.map((endpoint) => `${endpoint.method} ${endpoint.path} ${endpoint.description}`).join(' ')} frais LinkFlow pays opérateurs session tentative statut idempotence`,
  '/docs/webhooks': 'webhook événements notifications signature retries livraisons payment.succeeded payment.failed HMAC',
  '/docs/reference': 'erreurs idempotence expiration sécurité limites 400 401 403 404 409 429 503 Retry-After environnement XOF uncertain',
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

const hostedSessionResponse = `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": "/pay/demo-payment-token",
  "clientToken": "<session-client-token-fictif>",
  "publicKey": "<public-key-fictive>",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`;

const directSessionResponse = `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0043",
  "mode": "direct",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": null,
  "clientToken": "<session-client-token-fictif>",
  "publicKey": "<public-key-fictive>",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`;

const directAttemptResponse = `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043"
}`;

function ResponsePanel({ language, label, response }: { language: Language; label: string; response: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="sf-docs-code" data-testid="panel-response-example">
      <div className="sf-docs-code-head">
        <span className="sf-docs-code-label">{label}</span>
        <div className="sf-docs-code-tools">
          <button type="button" className="sf-docs-copy" onClick={() => void copy()} data-testid="button-copy-response">
            {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}
          </button>
        </div>
      </div>
      <pre><code>{renderHighlightedCode(response)}</code></pre>
      <div className="sf-docs-code-note">{language === 'fr' ? 'JSON · valeurs illustratives' : 'JSON · illustrative values'}</div>
    </div>
  );
}

function CodePanel({ language, label, example }: { language: Language; label: string; example: DocsExampleId }) {
  const [format, setFormat] = useState<DocsCodeFormat>('cURL');
  const [copied, setCopied] = useState(false);
  const formats = getDocsCodeFormats(example);
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
            {formats.map((option) => (
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
    <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.apiAvailabilityTitle}</strong>{t.apiAvailabilityText}</div></div>
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
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><ul className="sf-docs-list"><li>{t.notDocumentedText}</li><li>{t.noCredentials}</li><li>{t.baseUrlPending}</li><li>{t.environmentNote}</li></ul></section>
        </>}
        {pageKey === 'auth' && <>
          <section className="sf-docs-section"><h2>{t.notDocumented}</h2><p>{t.notDocumentedText}</p><p>{t.rotationText}</p><div className="sf-docs-callout">{t.serverOnly}</div>
            <CodePanel language={language} label={t.codeLabel} example="read-session" />
          </section>
          <section className="sf-docs-section"><h2>{t.credentialRolesTitle}</h2>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.credentialHeader}</th><th>{t.credentialUseHeader}</th><th>{t.credentialHandlingHeader}</th></tr></thead>
              <tbody>{localizedLists[language].credentialRows.map((row) => <tr key={row.credential}><td data-label={t.credentialHeader}>{row.credential}</td><td data-label={t.credentialUseHeader}>{row.usedFor}</td><td data-label={t.credentialHandlingHeader}>{row.handling}</td></tr>)}</tbody>
            </table>
          </section>
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><ul className="sf-docs-list"><li>{t.noCredentials}</li><li>{t.idempotencyText}</li></ul></section>
        </>}
        {pageKey === 'direct' && <>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.apiAvailabilityTitle}</strong>{t.apiAvailabilityText}</div></div>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{t.modelTextDirect}</p>
            <h3>{t.directFlow}</h3>
            <div className="sf-docs-steps">
              {localizedLists[language].directFlowTitles.map((heading, index) => <div className="sf-docs-step" key={heading}><span className="sf-docs-step-index">0{index + 1}</span><div><strong>{heading}</strong><p>{localizedLists[language].directFlowTexts[index]}</p></div></div>)}
            </div>
            <CodePanel language={language} label={t.codeLabel} example="create-direct" />
            <ResponsePanel language={language} label={t.responseExample} response={directSessionResponse} />
            <CodePanel language={language} label={t.codeLabel} example="read-public-session" />
            <div className="sf-docs-callout">{t.androidDirectNote}</div>
            <div className="sf-docs-callout">{t.directInputText}</div>
            <CodePanel language={language} label={t.codeLabel} example="start-attempt" />
            <ResponsePanel language={language} label={t.responseExample} response={directAttemptResponse} />
            <div className="sf-docs-callout">{t.pollTokenNote}</div>
            <CodePanel language={language} label={t.codeLabel} example="poll-attempt" />
            <div className="sf-docs-callout"><strong>{t.mobileMoneyTitle}.</strong> {t.mobileMoneyText}</div>
            <h3>{t.mobileMoneyActorsTitle}</h3>
            <div className="sf-docs-endpoints">
              {localizedLists[language].mobileMoneyActors.map((actor) => (
                <article className="sf-docs-endpoint sf-docs-info" key={actor.title}>
                  <div className="sf-docs-endpoint-head"><strong>{actor.title}</strong></div>
                  <p>{actor.body}</p>
                </article>
              ))}
            </div>
            <h3>{t.mobileMoneyCountryTitle}</h3>
            <div className="sf-docs-endpoints">
              {localizedLists[language].mobileMoneyCards.map((card) => (
                <article className="sf-docs-endpoint sf-docs-info" key={card.title}>
                  <div className="sf-docs-endpoint-head"><strong>{card.title}</strong><span className="sf-docs-endpoint-pending">{card.status}</span></div>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </section>
          <div className="sf-docs-callout"><strong>{t.webhookSharedNote}</strong> <Link href="/docs/webhooks">{t.webhookGuideLink}</Link></div>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
        </>}
        {pageKey === 'hosted' && <>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.apiAvailabilityTitle}</strong>{t.apiAvailabilityText}</div></div>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{t.modelTextHosted}</p>
            <h3>{t.hostedFlow}</h3>
            <div className="sf-docs-steps">
              {localizedLists[language].hostedFlowTitles.map((heading, index) => <div className="sf-docs-step" key={heading}><span className="sf-docs-step-index">0{index + 1}</span><div><strong>{heading}</strong><p>{localizedLists[language].hostedFlowTexts[index]}</p></div></div>)}
            </div>
            <CodePanel language={language} label={t.codeLabel} example="create-hosted" />
            <ResponsePanel language={language} label={t.responseExample} response={hostedSessionResponse} />
            <CodePanel language={language} label={t.codeLabel} example="read-session" />
            <div className="sf-docs-callout">
              <p>{t.hostedOriginText}</p>
              <p>{t.returnUrlText}</p>
              <p>{t.hostedFallbackText}</p>
              <p>{t.hostedTimerText}</p>
            </div>
          </section>
          <div className="sf-docs-callout"><strong>{t.webhookSharedNote}</strong> <Link href="/docs/webhooks">{t.webhookGuideLink}</Link></div>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
        </>}
        {pageKey === 'api' && <>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.apiAvailabilityTitle}</strong>{t.apiAvailabilityText}</div></div>
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
                    <ResponsePanel language={language} label={`${t.responseExample} · JSON`} response={endpoint.response} />
                  </details>
                </article>
              ))}
            </div>
            <p className="sf-docs-endpoint-note">{t.availableChoicesNote}</p>
            <div className="sf-docs-callout"><strong>{t.apiScopeTitle}.</strong> {t.apiScopeText}</div>
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
            <div className="sf-docs-callout">
              <strong>{t.webhookHeadersTitle}</strong>
              <p>{t.webhookHeadersText}</p>
              <pre className="sf-docs-response"><code>{`sendflow-event: payment.succeeded
sendflow-delivery: 9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644
sendflow-signature: t=<unix-timestamp>,v1=<hex-signature>`}</code></pre>
            </div>
            <ResponsePanel language={language} label={`${t.responseExample} · JSON`} response={`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644",
  "type": "payment.succeeded",
  "createdAt": "2026-10-29T10:30:00.000Z",
  "data": {
    "sessionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
    "transactionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28643",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "succeeded"
  }
}`} />
            <div className="sf-docs-callout">{t.webhookPayloadNote}</div>
            <CodePanel language={language} label={t.codeLabel} example="webhook" />
          </section>
        </>}
        {pageKey === 'ref' && <>
          <section className="sf-docs-section"><h2>{t.security}</h2><p>{t.securityText}</p></section>
          <section className="sf-docs-section"><h2>{t.errors}</h2><p>{t.errorsText}</p><ul className="sf-docs-list">
            <li>{t.error400}</li><li>{t.error401}</li><li>{t.error403}</li><li>{t.error404}</li>
            <li>{t.error409}</li><li>{t.error429}</li><li>{t.error503}</li>
          </ul></section>
          <section className="sf-docs-section"><h2>{t.troubleshootingTitle}</h2>
            <div className="sf-docs-endpoints">
              {localizedLists[language].troubleshooting.map((item) => (
                <article className="sf-docs-endpoint sf-docs-info" key={item.symptom}>
                  <div className="sf-docs-endpoint-head"><strong>{item.symptom}</strong></div>
                  <p>{item.action}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="sf-docs-section"><h2>{t.statesTitle}</h2><p>{t.statesText}</p>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{language === 'fr' ? 'État' : 'State'}</th><th>{language === 'fr' ? 'Signification' : 'Meaning'}</th><th>{language === 'fr' ? 'Action marchande' : 'Merchant action'}</th></tr></thead>
              <tbody>{localizedLists[language].paymentStateRows.map((row) => <tr key={row.state}><td data-label={language === 'fr' ? 'État' : 'State'}><code className="sf-docs-inline-code">{row.state}</code></td><td data-label={language === 'fr' ? 'Signification' : 'Meaning'}>{row.meaning}</td><td data-label={language === 'fr' ? 'Action marchande' : 'Merchant action'}>{row.action}</td></tr>)}</tbody>
            </table>
          </section>
          <section className="sf-docs-section"><h2>{t.idempotency}</h2><p>{t.idempotencyText}</p></section>
          <section className="sf-docs-section"><h2>{t.expiration}</h2><p>{t.expirationText}</p></section>
          <section className="sf-docs-section"><h2>{t.rateLimits}</h2><p>{t.rateLimitsText}</p></section>
          <div className="sf-docs-callout">{t.environmentNote}</div>
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
