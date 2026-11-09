import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight, BookOpen, Check, ChevronRight,
  Code2, Copy, Globe2, LifeBuoy, LockKeyhole, Menu, Search, ShieldCheck,
  Webhook, X,
} from 'lucide-react';
import sendflowMark from '@/assets/sendflow-mark-original.png';
import sendflowWordmark from '@/assets/sendflow-wordmark-original.png';
import apiIntegrationIllustration from '../assets/docs-api-integration-3d.webp';
import hostedCheckoutIllustration from '../assets/docs-hosted-checkout-3d.webp';
import { useSeo } from '@/lib/seo';
import { getDocumentationPageKey } from '@/lib/documentation-host';
import ServerNotFoundNavigation from '@/components/server-not-found-navigation';
import { productionUrls } from './docs-production-urls.ts';
import { getDocsCodeExample, getDocsCodeFormats, type DocsCodeFormat, type DocsExampleId } from './docs-code-examples';
import './docs.css';

type Language = 'fr' | 'en';
type DocGroup = 'start' | 'hosted' | 'integration' | 'webhooks' | 'reliability';
type DocItem = { path: string; key: string; label: string; group: DocGroup; icon: typeof BookOpen; section?: string; search?: string };
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
  mobileMoneyOtpRows: { flow: string; response: string; action: string }[];
  mobileMoneyFlowRows: { flow: string; response: string; action: string }[];
  mobileMoneyCards: { title: string; status: string; code: string; body: string; countryCode?: string; flag?: string }[];
  troubleshooting: { symptom: string; action: string }[];
  credentialRows: { credential: string; usedFor: string; handling: string }[];
  paymentStateRows: { state: string; meaning: string; action: string }[];
  httpErrorRows: { status: string; meaning: string; action: string }[];
};

const docsItems: DocItem[] = [
  { path: '/docs', key: 'home', label: 'Documentation', group: 'start', icon: BookOpen },
  { path: '/docs/getting-started', key: 'start', label: 'Getting started', group: 'start', icon: ArrowRight },
  { path: '/docs/authentication', key: 'auth', label: 'Authentication', group: 'start', icon: LockKeyhole },
  { path: '/docs/integrations/direct', key: 'direct', label: 'Direct API', group: 'integration', icon: Code2 },
  { path: '/docs/integrations/hosted', key: 'hosted', label: 'Hosted Checkout', group: 'hosted', icon: Globe2 },
  { path: '/docs/webhooks', key: 'webhooks', label: 'Webhooks', group: 'webhooks', icon: Webhook },
  { path: '/docs/reference', key: 'reference', label: 'Errors & security', group: 'reliability', icon: ShieldCheck },
];

const docGroups: { id: DocGroup; labelKey: string; icon: typeof BookOpen }[] = [
  { id: 'start', labelKey: 'startGroup', icon: BookOpen },
  { id: 'hosted', labelKey: 'hostedGroup', icon: Globe2 },
  { id: 'integration', labelKey: 'integrationGroup', icon: Code2 },
  { id: 'webhooks', labelKey: 'webhooksGroup', icon: Webhook },
  { id: 'reliability', labelKey: 'reliabilityGroup', icon: ShieldCheck },
];

const localized: Record<Language, Translation> = {
  fr: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'API directe', navWebhooks: 'Webhooks',
    search: 'Rechercher dans la documentation…', menuClose: 'Fermer le menu', startGroup: 'Démarrer',
    sectionPageIntro: 'Cette rubrique détaille le contrat SendFlow correspondant. Les exemples utilisent des données d’exemple ; les parcours disponibles dépendent de la réponse de l’API.',
    integrations: 'Parcours de paiement', integrationGroup: 'Intégration API',
    hostedGroup: 'Paiement hébergé', webhooksGroup: 'Webhooks',
    reliabilityGroup: 'États, erreurs et sécurité',
    endpointGroupSessions: '1. Sessions serveur',
    endpointGroupDirect: '2. Caisse API directe',
    endpointGroupCatalog: '3. Catalogue public et limites',
    reference: 'Référence', resources: 'Ressources', noResults: 'Aucun document ne correspond à cette recherche.',
    webhookRetries: 'Relances et déduplication',
    home: 'Documentation', start: 'Bien démarrer', auth: 'Authentification', direct: 'API directe',
    hosted: 'Paiement hébergé', webhooks: 'Webhooks', ref: 'Erreurs et sécurité',
    badge: 'API REST · JSON', prod: 'Documentation API SendFlow',
    homeTitle: 'Intégrez SendFlow à votre plateforme',
    homeSub: 'Découvrez les outils et les API nécessaires pour accepter les paiements avec SendFlow.',
    startTitle: 'Démarrer', startWelcomeTitle: 'Bienvenue sur SendFlow',
    startSub: 'Intégrez les paiements Mobile Money de SendFlow à votre application avec un parcours hébergé ou une API directe.',
    authTitle: 'Authentification', authSub: 'Utilisez la clé secrète pour les appels serveur et la clé publique uniquement dans le parcours de caisse.',
    directTitle: 'Intégration API directe', directSub: 'Un guide complet : accès, catalogue, session, tentative Mobile Money, confirmation serveur et webhooks.',
    directPrerequisitesTitle: 'Avant de commencer',
    directPrerequisitesText: 'Préparez un compte marchand actif et éligible, une paire de clés API SendFlow et un serveur capable d’appeler l’API en HTTPS. Créez la session avec la clé secrète côté serveur. Transmettez à la caisse uniquement la clé publique et les jetons limités à cette session ou tentative. Les exemples ci-dessous montrent les routes et le contrat SendFlow ; utilisez la réponse de la session pour connaître les parcours proposés.',
    directCredentialsTitle: 'Identifiants requis pour chaque étape',
    directCatalogTitle: 'Étape 1 · Préparer le montant et les choix',
    directCatalogText: 'GET /api/pricing est une lecture publique du catalogue et des frais configurés ; la session directe reste la source de vérité des opérateurs disponibles. Sa réponse fournit requiresOtp et otpCommand quand ils sont configurés. GET /api/payment-limits donne les bornes ; le montant entier en XOF est revérifié côté serveur. Pour une commande contenant le montant, utilisez le modèle configuré et l’instruction exacte renvoyée par SendFlow.',
    directSessionReturnNote: 'En mode direct, votre application conserve son propre écran et son propre retour de parcours. returnUrl sert au parcours Hosted Checkout, pas à confirmer une session directe. Quelle que soit l’interface, une redirection ou un état navigateur ne prouve pas le paiement.',
    hostedTitle: 'Paiement par redirection', hostedSub: 'Créez une session hébergée et redirigez le payeur vers le chemin de paiement SendFlow retourné par l’API.',
    apiTitle: 'Référence API', apiSub: 'Endpoints REST disponibles, paramètres, authentification, limites et réponses du contrat SendFlow.',
    webhooksTitle: 'Webhooks', webhooksSub: 'Configurez les notifications de paiement, vérifiez leur signature et traitez les livraisons répétées sans doublon.',
    refTitle: 'Erreurs, idempotence et sécurité', refSub: 'Réponses HTTP, durées, plafonds de requêtes et règles essentielles pour intégrer les paiements de façon fiable.',
    breadcrumb: 'Documentation API', methods: 'Choisissez votre méthode', methodsSub: 'Les deux parcours utilisent des sessions SendFlow et la même confirmation serveur du paiement.',
    directCard: 'API directe', directCardSub: 'Votre serveur contrôle le parcours et orchestre l’expérience dans votre application.',
    hostedCard: 'Paiement hébergé', hostedCardSub: 'Votre serveur crée la session, puis redirige le client vers la page de paiement hébergée SendFlow.',
    methodLevel: 'Niveau', methodControl: 'Contrôle du parcours', methodIntegration: 'Intégration', methodAuth: 'Authentification', methodReturn: 'Retour du paiement',
    developerLevel: 'Développeur', simpleLevel: 'Simple', highControl: 'Élevé', hostedControl: 'Limité à la page hébergée',
    restApi: 'API REST', sessionRedirect: 'Création de session puis redirection',
    authContract: 'Clé secrète côté serveur', returnToConfirm: 'Retour navigateur non probant',
    directGuide: 'Voir le guide API directe', hostedGuide: 'Voir le guide de redirection',
    capabilitiesTitle: 'Ce que vous pouvez faire',
    capabilitySession: 'Créer une session de paiement depuis votre serveur marchand.',
    capabilityCheckout: 'Présenter un parcours hébergé SendFlow au payeur.',
    capabilityDirect: 'Intégrer directement la caisse dans votre application.',
    capabilityStatus: 'Consulter le statut d’une session et d’une tentative.',
    capabilityWebhook: 'Recevoir les notifications de paiement réussi ou échoué par webhook.',
    baseUrlTitle: 'Adresses',
    apiBaseUrlLabel: 'API SendFlow · SENDFLOW_API_BASE_URL',
    checkoutOriginLabel: 'Paiement hébergé · SENDFLOW_CHECKOUT_ORIGIN',
    merchantAppLabel: 'Application marchand',
    publicSiteLabel: 'Site public SendFlow',
    documentationUrlLabel: 'Documentation API',
    baseUrlPending: 'Copiez chaque adresse depuis son bloc. Configurez les variables nécessaires sur votre serveur marchand et ne placez jamais la clé secrète dans le navigateur.',
    quickstartTitle: 'Démarrage rapide',
    quickstartPrereqTitle: 'Prérequis',
    quickstartPrereqText: 'Un compte marchand avec accès à l’API et une paire de clés SendFlow. Configurez SENDFLOW_API_BASE_URL et SENDFLOW_SECRET_KEY dans l’environnement de votre serveur. SENDFLOW_CHECKOUT_ORIGIN est nécessaire uniquement pour Hosted Checkout.',
    quickstartCatalogTitle: 'Pays, opérateurs, frais et politique OTP',
    quickstartCatalogText: 'GET /pricing renvoie le catalogue des pays et opérateurs avec requiresOtp et otpCommand lorsqu’ils sont configurés. Filtrez ces champs à partir de la réponse : les exemples affichent dynamiquement le pays, l’opérateur et son instruction, sans liste codée en dur. otpCommand, s’il est présent, est un code ou une consigne à composer, pas l’OTP personnel du payeur. Ces métadonnées ne confirment ni un paiement ni la disponibilité dans LinkFlow ; pour payer, utilisez uniquement les choix retournés par la session.',
    quickstartLimitsTitle: 'Vérifier les limites de paiement',
    quickstartLimitsText: 'GET /payment-limits renvoie les limites actuellement configurées. Le serveur valide toujours le montant au moment de créer la session.',
    quickstartDirectTitle: 'Créer une session de paiement directe',
    quickstartDirectText: 'Créez la session depuis votre serveur marchand avec un montant fixe en XOF et une clé Idempotency-Key unique pour cette opération. Le montant ne peut pas être modifié par le payeur.',
    quickstartChoicesTitle: 'Charger les choix de paiement',
    quickstartChoicesText: 'Utilisez l’identifiant, la clé publique et le jeton de la session créée. Affichez uniquement les pays et opérateurs renvoyés par cette session.',
    quickstartAttemptTitle: 'Démarrer une tentative Mobile Money',
    quickstartAttemptText: 'Après le choix du moyen, démarrez la tentative avec les champs prévus par l’API ; le montant reste celui de la session. L’opérateur adresse ensuite une demande de confirmation USSD au payeur, qui la valide sur son téléphone. Affichez ussdCode exactement s’il est renvoyé ; cette valeur peut être null.',
    quickstartStatusTitle: 'Vérifier le statut',
    quickstartStatusText: 'Relisez la session depuis votre serveur avec la clé secrète ou vérifiez le webhook après validation de sa signature. Ne confirmez la commande qu’après un état succeeded.',
    quickstartIntegrationNote: 'Copiez les adresses dans les blocs ci-dessus. Remplacez les valeurs d’exemple par celles de votre compte et gardez la clé secrète côté serveur.',
    threeSteps: 'Parcours recommandé', stepOne: 'Créez votre compte marchand', stepOneSub: 'Un compte marchand actif et éligible est requis pour utiliser les paiements API.', stepTwo: 'Configurez vos clés API', stepTwoSub: 'Créez ou régénérez votre paire dans l’espace Développeurs ; la clé secrète ne s’affiche qu’à sa création.', stepThree: 'Intégrez SendFlow à votre application', stepThreeSub: 'Créez la session côté serveur et vérifiez le résultat auprès de SendFlow.',
    read: 'Lire le guide', support: 'Besoin d’aide ?', supportSub: 'Contactez l’équipe SendFlow pour toute question liée à votre intégration.', contact: 'Contacter le support',
    disclaimerTitle: 'Confirmation du paiement', disclaimer: 'Ne marquez jamais une commande comme payée sur la seule base d’une redirection ou d’un état affiché dans le navigateur. Vérifiez le statut serveur ou traitez un webhook dont la signature est valide.',
    whatIs: 'Paiements SendFlow pour les marchands',
    whatIsText: 'SendFlow propose une API de paiement pour intégrer un parcours hébergé ou une caisse directe, puis vérifier les opérations côté serveur.',
    prerequisites: 'Prérequis', noCredentials: 'Ne placez jamais la clé secrète dans le navigateur, une application mobile distribuée, un dépôt public ou des journaux.',
    notDocumented: 'Gestion des clés API', notDocumentedText: 'Une paire initiale est créée à l’inscription et incluse dans la réponse de création du compte. Vous pouvez ensuite créer une nouvelle paire dans l’espace Développeurs ; cette opération révoque immédiatement l’ancienne. Les clés ne portent pas de permissions configurables par clé : SendFlow contrôle l’accès et l’éligibilité côté serveur selon l’opération. La clé secrète sert aux appels privés depuis votre serveur ; la clé publique sert uniquement aux appels de caisse du parcours direct.',
    rotationText: 'La clé secrète complète est renvoyée uniquement dans la réponse d’inscription ou de création/régénération de la paire ; la liste des clés ne montre que son préfixe. Enregistrez-la dans un gestionnaire de secrets. Si vous l’avez perdue, régénérez la paire : l’ancienne est immédiatement désactivée.',
    serverOnly: 'Envoyez la clé secrète dans l’en-tête Authorization: Bearer depuis votre serveur. Ne la transmettez jamais au client.',
    credentialRolesTitle: 'Rôle et emplacement de chaque identifiant',
    credentialHeader: 'Identifiant', credentialUseHeader: 'Utilisation', credentialHandlingHeader: 'Protection',
    pollTokenNote: 'Le pollToken est un identifiant d’accès à la tentative. Préférez interroger l’état depuis votre serveur avec la clé secrète ; si le client doit le recevoir pour afficher la progression, gardez-le temporairement en mémoire et excluez-le des journaux, URL et outils analytiques.',
    codeLabel: 'Exemple de requête', placeholder: 'Requête API',
    endpointGroupNote: 'Les endpoints sont regroupés par étape et par contexte d’exécution.',
    directExamplesTitle: 'Étapes d’intégration',
    directStepCatalog: 'Étape 1 · Lire le catalogue et les limites',
    directStepCreate: 'Étape 2 · Créer la session sur votre serveur',
    directStepRead: 'Étape 3 · Charger les choix de la session',
    directStepAttempt: 'Étape 4 · Démarrer la tentative dans la caisse',
    directStepPoll: 'Étape 5 · Suivre puis confirmer côté serveur',
    directWebhookSetupTitle: 'Configurer les notifications de paiement',
    directWebhookSetupText: 'Dans votre espace Développeurs, ajoutez l’URL HTTPS publique de votre propre serveur, sélectionnez les événements utiles et conservez le secret de signature affiché à la création. Cette configuration se fait dans l’espace marchand ; ce n’est pas un endpoint de création webhook de l’API de paiement. SendFlow accepte jusqu’à cinq endpoints actifs par compte.',
    directWebhookDeliveryText: 'Vérifiez la signature sur les octets bruts et l’horodatage avant de parser l’événement. Enregistrez-le de façon idempotente avant de répondre 2xx ; l’ordre des livraisons n’est pas garanti.',
    directReliabilityTitle: 'Idempotence, états et erreurs',
    directReliabilityText: 'Réutilisez la même Idempotency-Key uniquement pour reprendre exactement la même opération. Une session expire une heure après sa création. created, waiting et uncertain ne sont pas des confirmations finales. Sur une création qui répond 503 avant de renvoyer un identifiant, aucune session ou demande n’a été créée ; sur une lecture 503 d’une ressource existante, le résultat reste à vérifier.',
    hostedExamplesTitle: 'Exemples dans l’ordre du parcours',
    hostedStepCreate: 'Étape 1 · Créer la session et préparer le lien',
    hostedStepStatus: 'Étape 2 · Vérifier le statut côté serveur',
    model: 'Parcours de paiement', modelTextDirect: 'Créez la session avec mode direct depuis votre serveur. Le client lit ensuite la session publique, affiche les pays et opérateurs disponibles, lance une tentative pour le montant fixe, puis suit le statut.',
    modelTextHosted: 'Créez la session avec mode hosted depuis votre serveur. L’API renvoie checkoutPath ; combinez-le avec la valeur SENDFLOW_CHECKOUT_ORIGIN copiée dans le bloc correspondant, puis redirigez le client.',
    apiAvailabilityTitle: 'Adresse de l’API',
    apiAvailabilityText: 'Toutes les requêtes utilisent l’adresse indiquée dans le bloc copiable « API SendFlow ». Cette page décrit le contrat de l’API ; elle ne mesure pas sa disponibilité en temps réel. La prise en charge dépend du mode choisi, du pays, de l’opérateur et des choix renvoyés par la session.',
    hostedOriginText: 'checkoutPath reste un chemin relatif pour préserver le contrat API. Pour un paiement hébergé ou un lien LinkFlow, combinez-le avec la valeur copiée dans SENDFLOW_CHECKOUT_ORIGIN sur votre serveur marchand.',
    hostedFallbackText: 'Après une confirmation succeeded, la page redirige vers returnUrl si elle a été fournie ; sinon, elle revient vers le site public SendFlow. La page ne redirige pas vers returnUrl après un échec confirmé. Une redirection reste une indication d’interface, jamais une preuve de paiement.',
    webhookSharedNote: 'Les webhooks reflètent les événements enregistrés côté serveur. payout.succeeded n’est émis qu’après une confirmation finale vérifiée ; consultez le guide Webhooks pour vérifier la signature et dédupliquer les livraisons.',
    webhookGuideLink: 'Ouvrir le guide Webhooks',
    mobileMoneyTitle: 'Mobile Money et confirmation USSD',
    mobileMoneyText: 'La session directe renvoie les pays et opérateurs disponibles, avec requiresOtp et otpCommand lorsque ces valeurs sont configurées. Pour un OTP obtenu avant la requête, envoyez otp dans le corps. Pour un défi OTP démarré par l’opérateur, la réponse renvoie flow.action = "enter_otp" et flow.reference ; reprenez la même requête avec la même Idempotency-Key, cette référence et otp. otpCommand est une instruction à composer, jamais l’OTP personnel. Pour un parcours de redirection, suivez flow.redirectUrl uniquement lorsque flow.action vaut "open_redirect" ; returnUrl reste le retour marchand après paiement. Dans tous les cas, confirmez le résultat avec le statut serveur ou le webhook signé.',
    mobileMoneyOtpTitle: 'Parcours OTP et codes USSD',
    mobileMoneyOtpText: 'Le tableau donne des exemples d’instructions par opérateur. La valeur opérationnelle est toujours celle de otpCommand renvoyée par SendFlow : ne codez pas les commandes en dur. Pour une commande liée au montant, configurez le modèle avec {amount} ; SendFlow remplace ce jeton par le montant XOF exact. Si le montant est variable, l’instruction exacte arrive avec la tentative. Envoyez l’OTP uniquement dans le champ otp prévu.',
    mobileMoneyOtpExampleTitle: 'Exemple de tentative avec le contrat SendFlow',
    mobileMoneyOtpExampleNote: 'Le corps utilise countryCode, operatorId et phoneNumber. Pour un OTP préalablement obtenu, ajoutez otp. Pour un défi démarré par l’opérateur, renvoyez le même corps avec la même Idempotency-Key, flow.reference et otp. Une réponse initiale ne confirme jamais le paiement : vérifiez le statut serveur ou le webhook signé.',
    mobileMoneyWaveTitle: 'Wave et redirection',
    mobileMoneyWaveText: 'Si la session choisie utilise une redirection, la tentative renvoie flow.action = "open_redirect" et l’URL générée par le serveur dans flow.redirectUrl. Ouvrez exactement cette URL. Ne construisez pas de lien d’application et n’utilisez pas returnUrl à la place.',
    mobileMoneyFlowsTitle: 'Résumé des parcours',
    mobileMoneyFlowHeader: 'Parcours',
    mobileMoneyResponseHeader: 'Réponse SendFlow',
    mobileMoneyActionHeader: 'Action correcte',
    mobileMoneyActorsTitle: 'Qui fait quoi dans le parcours Mobile Money ?',
    mobileMoneyCountryTitle: 'Codes et parcours par pays — références à confirmer',
    mobileMoneyCountryHeader: 'Pays · opérateur',
    mobileMoneyStatusHeader: 'Parcours de référence',
    mobileMoneyCodeHeader: 'Code / redirection',
    mobileMoneyDetailsHeader: 'Règle SendFlow actuelle',
    androidDirectNote: 'L’exemple Kotlin ci-dessous utilise les routes publiques de session directe depuis Android. Il s’agit d’un exemple REST, pas d’un SDK officiel ; il suppose kotlinx-coroutines-android. Créez la session sur votre serveur et transmettez seulement la clé publique et les jetons de session nécessaires.',
    directInputText: 'Attention au format : la session peut renvoyer un code pays en minuscules (par exemple ci), mais la création de tentative exige deux lettres majuscules (CI). Convertissez-le en majuscules. phoneNumber doit inclure l’indicatif international renvoyé par la session (par exemple +225 suivi du numéro national). Utilisez operatorId directement depuis la réponse de session.',
    directCorsNote: 'Les routes /api/v1/public/* ont leur propre configuration CORS : les appels navigateur sont autorisés sans cookies, en GET/POST/OPTIONS, avec Content-Type, X-SendFlow-Public-Key, X-SendFlow-Client-Token, X-LinkFlow-Attempt-Token et Idempotency-Key. La création et la lecture privée d’une session avec Authorization: Bearer restent côté serveur. N’exposez jamais la clé secrète dans le navigateur.',
    hostedTimerText: 'La page hébergée affiche un compte à rebours d’attente de 10 minutes. Son expiration peut afficher une vue d’échec au payeur, mais le suivi serveur continue et une confirmation finale reçue ensuite prévaut. Le compte à rebours n’est pas un statut de paiement : vérifiez l’état serveur ou un webhook signé et traitez uncertain comme non final.',
    responsibilities: 'Bonnes pratiques pour une intégration financière',
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
    webhookEvents: 'Événements webhook', webhookEventsSub: 'Les événements disponibles sont payment.succeeded, payment.failed, payout.created, payout.processing, payout.succeeded, payout.failed et payout.uncertain. Les événements payout ne sont émis que pour les transitions enregistrées côté serveur ; payout.succeeded exige une confirmation finale vérifiée.',
    webhookPayloadNote: 'Les payloads paiement contiennent les identifiants de session, tentative et transaction. Les payloads payout contiennent la référence, les montants, les frais, le pays, l’opérateur et le statut, sans numéro de bénéficiaire. Le champ id correspond à l’UUID sendflow-delivery et reste stable lors des reprises. Le même contrôle de signature s’applique aux deux familles d’événements. N’insérez aucune donnée personnelle dans merchantReference.',
    eventNames: 'Événements disponibles', delivery: 'Signature et livraisons', deliveryText: 'La signature HMAC-SHA256 est calculée sur la chaîne <horodatage>.<corps JSON brut>. Répondez en HTTP 2xx pour acquitter la livraison ; toute réponse non-2xx, erreur réseau ou expiration du délai sera retentée. Le délai de requête est de 8 secondes et le corps de réponse est limité à 8 Ko. SendFlow effectue 8 tentatives au total au maximum : l’envoi initial puis jusqu’à 7 reprises, espacées de 10 s, 30 s, 2 min, 10 min, 30 min, 2 h et 12 h. L’identifiant sendflow-delivery reste stable entre les reprises : utilisez-le pour dédupliquer.',
    webhookHeadersTitle: 'En-têtes envoyés', webhookHeadersText: 'sendflow-event identifie le type d’événement. sendflow-delivery contient le même UUID que payload.id et reste identique lors des reprises. sendflow-signature suit le format t=<horodatage Unix>,v1=<signature hexadécimale>. La signature est calculée sur les octets exacts du corps reçu. L’exemple de vérification choisit une fenêtre de fraîcheur de 300 secondes à titre de politique marchande ; SendFlow ne fixe pas cette valeur.',
    apiScopeTitle: 'Flux PAYIN et PAYOUT', apiScopeText: 'PAYIN : le client paie par Mobile Money ; après confirmation finale vérifiée côté serveur, le montant net est crédité au portefeuille SendFlow du marchand. PAYOUT : le marchand demande un transfert sortant depuis le solde disponible de son portefeuille vers le compte Mobile Money d’un bénéficiaire. SendFlow calcule les montants, frais et réservations côté serveur. Le catalogue et le devis ne déclenchent pas un transfert ; vérifiez le statut côté serveur et ne traitez le paiement comme final qu’après confirmation vérifiée.',
    endpointLimits: 'Limites de paiement',
    endpointLimitsDesc: 'Renvoie les seuils FCFA actuellement configurés. Cette lecture publique ne remplace jamais la validation serveur.',
    endpointPayout: 'API de retrait',
    payoutApiTitle: 'Payout marchand via API',
    payoutApiText: 'Le PAYOUT est un transfert sortant du portefeuille SendFlow du marchand authentifié vers le compte Mobile Money d’un bénéficiaire. Le solde utilisable est calculé après déduction des réservations actives ; les frais et montants sont validés côté serveur. Le devis ne réserve aucun fonds. operations.payout=true dans /api/pricing indique une configuration de catalogue, pas une disponibilité garantie : l’éligibilité du compte, le routage, le tarif, les limites et le solde sont vérifiés pour la demande.',
    payoutQuoteTitle: '1. Calculer le devis',
    payoutQuoteText: 'POST /api/v1/payout-quote est une lecture sans réservation. Repérez un pays et un opérateur avec operations.payout=true dans /api/pricing, puis envoyez amountMinor en entier XOF, countryCode en minuscules, son operatorId exact et feePayer (merchant ou beneficiary). La réponse inclut les montants calculés, le solde disponible, les limites, la version tarifaire et quoteExpiresAt. Une configuration ou un canal indisponible peut répondre 503.',
    payoutCreateTitle: '2. Envoyer une demande de payout',
    payoutCreateText: 'POST /api/v1/payouts demande un transfert vers le compte Mobile Money du bénéficiaire. Il exige la clé secrète active du marchand dans Authorization: Bearer, Idempotency-Key (8–128 caractères), pays, opérateur, montant, devise, payeur de frais et numéro international correspondant au pays. Les clés ne portent pas de permissions configurables par clé : SendFlow vérifie l’état et l’éligibilité du compte côté serveur. SendFlow recalcule le tarif et le solde disponible ; le devis n’autorise pas le transfert. Réutilisez la même clé pour une reprise exacte. En cas de 503 ou de délai d’attente, vérifiez l’état de la demande avant toute nouvelle tentative.',
    payoutListTitle: '3. Lister les demandes',
    payoutListText: 'GET /api/v1/payouts ne retourne que les demandes du marchand authentifié. limit accepte 1–100 (25 par défaut), cursor un UUID et status un état de payout.',
    payoutReadTitle: '4. Consulter une demande',
    payoutReadText: 'GET /api/v1/payouts/{payoutId} exige l’UUID renvoyé par une demande existante du même marchand. Le téléphone du bénéficiaire est masqué.',
    payoutCancelTitle: '5. Annuler avant envoi',
    payoutCancelText: 'POST /api/v1/payouts/{payoutId}/cancel ne fonctionne que si les fonds sont réservés et que l’exécution SendFlow n’a pas commencé. Après envoi ou si l’état ne permet plus l’annulation, l’API renvoie 409.',
    security: 'Sécurité et fiabilité', errors: 'Erreurs HTTP', idempotency: 'Idempotence', expiration: 'Expiration et montants', securityText: 'Utilisez HTTPS. Stockez la clé secrète et le secret webhook (affiché une seule fois à sa création) dans un coffre sécurisé. Comparez la signature en temps constant, vérifiez la fraîcheur de l’horodatage et ne traitez l’événement qu’après validation.',
    errorsText: 'Les routes documentées renvoient une erreur JSON sous la forme { "error": "…" }. Le contrat ne définit pas de code d’erreur machine stable : basez votre traitement sur le statut HTTP et vos propres règles, pas sur le texte du message. Un HTTP 503 signifie que la route ne peut pas traiter la demande à cet instant ; il ne prouve ni succès ni échec final. Pour une ressource déjà créée, relisez son statut ou vérifiez le webhook signé avant toute décision. Une redirection ou un état navigateur ne confirme jamais un paiement.',
    globalHttpErrors: 'Une requête peut renvoyer 413 si son corps dépasse 100 Ko ou 415 si son encodage n’est pas pris en charge. Une erreur serveur inattendue peut renvoyer 500. Les réponses conservent le format JSON { "error": "…" } ; en cas de 500/503, ne déduisez jamais le résultat du paiement.',
    errorEnvelopeTitle: 'Format d’erreur',
    httpErrorTableTitle: 'Réponses HTTP et conduite à tenir',
    errorStatusHeader: 'HTTP', errorMeaningHeader: 'Signification', errorActionHeader: 'Action recommandée',
    parametersTitle: 'Paramètres du contrat', parameterFieldHeader: 'Champ / emplacement',
    parameterTypeHeader: 'Type', parameterRequirementHeader: 'Exigence', parameterDescriptionHeader: 'Description',
    noParameters: 'Aucun paramètre de requête ni authentification n’est requis.',
    error400: '400 — corps, paramètres ou en-têtes invalides ; montant, devise, mode, URL HTTPS, métadonnées, pays, opérateur ou numéro non conformes au contrat.',
    error401: '401 — clé secrète absente, invalide ou révoquée. Vérifiez le secret côté serveur et l’en-tête Authorization: Bearer ; ne l’incluez jamais dans l’application cliente.',
    error403: '403 — compte marchand non autorisé ou non éligible à la création de paiements API.',
    error404: '404 — session, tentative ou identifiants publics indisponibles. Les identifiants publics invalides, une session expirée ou un mauvais mode peuvent aussi être masqués par cette réponse.',
    error409: '409 — référence marchand déjà utilisée ou clé Idempotency-Key réutilisée avec un corps différent. Pour une reprise, renvoyez la même requête avec la même clé ; une nouvelle opération métier reçoit une nouvelle clé.',
    error429: '429 — limite de requêtes atteinte. Respectez Retry-After: 60, ralentissez les vérifications de statut et ne relancez pas immédiatement.',
    error503: '503 — opération indisponible. Le résultat dépend de la route : une création refusée avant émission d’un identifiant ne peut pas être consultée ; pour une session ou tentative déjà créée, relisez le statut ou vérifiez le webhook. Ce statut seul ne prouve jamais un succès ni un échec final.',
    idempotencyText: 'Pour chaque création de session ou de tentative, envoyez une clé Idempotency-Key stable de 8 à 128 caractères, sans espace en début ou fin. Une reprise avec la même clé et le même corps renvoie la même opération ; la réutiliser avec une autre demande renvoie 409. Une référence marchand déjà utilisée renvoie aussi 409. Utilisez une nouvelle clé uniquement pour une nouvelle opération métier.',
    expirationText: 'Les sessions expirent une heure après leur création. Après expiration, les choix publics et le démarrage d’une tentative ne sont plus disponibles. La lecture serveur de la session et la vérification d’une tentative déjà créée restent possibles avec des identifiants valides. Le montant est fixe en XOF et doit respecter les limites actuellement renvoyées par GET /api/payment-limits ; le payeur ne peut pas le modifier.',
    rateLimits: 'Limites de requêtes', rateLimitsText: 'Par clé API et par fenêtre d’une minute : 30 créations de session, 120 lectures, 5 tentatives directes et 60 vérifications de statut. La création de session a aussi une limite de 10 par minute au niveau du compte marchand. Par adresse IP, les lectures publiques de session sont limitées à 120 par minute, les tentatives à 5 et les vérifications à 60. Les quotas de clé, de compte et d’adresse IP peuvent s’appliquer ensemble. En cas de limitation, l’API renvoie 429 et Retry-After: 60 ; attendez ce délai avant de reprendre.',
    statesTitle: 'États d’un paiement', statesText: 'Les états de session et de tentative décrivent l’avancement du paiement ; seul un état final confirmé peut déclencher la validation de votre commande.',
    serviceAvailability: 'Adresses et suivi', serviceAvailabilityText: 'Consultez le statut ou le webhook signé uniquement pour une session ou tentative déjà créée. Si la création répond 503 avant de renvoyer un identifiant, aucune session n’existe à consulter. Une redirection du navigateur ne constitue jamais une confirmation.',
    environmentNote: 'Les adresses sont présentées individuellement dans des blocs copiables.',
    troubleshootingTitle: 'Diagnostic rapide',
    hostedFlow: 'Parcours de redirection', directFlow: 'Parcours API directe', returnUrlTitle: 'Configurer le retour après paiement', returnUrlText: 'Pour chaque session hosted, renseignez le champ facultatif returnUrl dans le JSON de POST /api/v1/payment-sessions avec l’URL HTTPS de votre propre page de retour ; la requête copiable ci-dessus montre où la saisir. Ce champ n’est pas SENDFLOW_CHECKOUT_ORIGIN, qui désigne le checkout hébergé SendFlow. L’URL doit faire au plus 2 048 caractères et ne peut pas contenir d’identifiants intégrés. La redirection a lieu uniquement après confirmation succeeded ; après un échec, le checkout ne redirige pas vers returnUrl. Si le champ est omis, le checkout revient vers SendFlow. Vérifiez toujours le statut serveur ou le webhook signé : la redirection n’est pas une preuve de paiement.',
    language: 'Langue', copyright: 'SendFlow · Documentation API', lastUpdated: 'Référence API v1',
    contents: 'Sommaire',
  },
  en: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'Direct API', navWebhooks: 'Webhooks',
    search: 'Search documentation…', menuClose: 'Close menu', startGroup: 'Start here',
    sectionPageIntro: 'This section details the matching SendFlow contract. Examples use sample data; available flows depend on the API response.',
    integrations: 'Payment flows', integrationGroup: 'API integration',
    hostedGroup: 'Hosted Checkout', webhooksGroup: 'Webhooks',
    reliabilityGroup: 'States, errors & security',
    endpointGroupSessions: '1. Server sessions',
    endpointGroupDirect: '2. Direct checkout',
    endpointGroupCatalog: '3. Public catalog & limits',
    reference: 'Reference', resources: 'Resources', noResults: 'No documents match your search.',
    webhookRetries: 'Retries & deduplication',
    home: 'Documentation', start: 'Getting started', auth: 'Authentication', direct: 'Direct API',
    hosted: 'Hosted Checkout', webhooks: 'Webhooks', ref: 'Errors & security',
    badge: 'REST API · JSON', prod: 'SendFlow API documentation',
    homeTitle: 'Integrate SendFlow with your platform',
    homeSub: 'Discover the tools and APIs you need to accept payments with SendFlow.',
    startTitle: 'Get started', startWelcomeTitle: 'Welcome to SendFlow',
    startSub: 'Integrate SendFlow Mobile Money payments into your app with hosted checkout or a direct API flow.',
    authTitle: 'Authentication', authSub: 'Use the secret key for server requests and the public key only in the checkout flow.',
    directTitle: 'Direct API integration', directSub: 'A complete guide to access, catalog, session, Mobile Money attempt, server confirmation, and webhooks.',
    directPrerequisitesTitle: 'Before you start',
    directPrerequisitesText: 'Prepare an active, eligible merchant account, a SendFlow API key pair, and a server that can call the API over HTTPS. Create sessions with the secret key on your server. Pass only the public key and session- or attempt-scoped tokens to checkout. The examples show the SendFlow routes and contract; use the session response to determine the offered flows.',
    directCredentialsTitle: 'Credentials required at each step',
    directCatalogTitle: 'Step 1 · Prepare the amount and payment choices',
    directCatalogText: 'GET /api/pricing is a public read of the catalog and configured fees; the direct session remains the source of truth for available operators. Its response includes requiresOtp and otpCommand when configured. GET /api/payment-limits returns configured thresholds; whole XOF amounts are validated again server-side. For commands containing the amount, use the configured template and the exact instruction returned by SendFlow.',
    directSessionReturnNote: 'In direct mode, your application keeps its own screens and return flow. returnUrl is for Hosted Checkout, not for confirming a direct session. A redirect or browser state never proves payment.',
    hostedTitle: 'Hosted payment redirect', hostedSub: 'Create a hosted session and redirect the payer to the SendFlow payment path returned by the API.',
    apiTitle: 'API reference', apiSub: 'Available REST endpoints, parameters, authentication, limits, and SendFlow contract responses.',
    webhooksTitle: 'Webhooks', webhooksSub: 'Configure payment notifications, verify their signatures, and safely process repeated deliveries.',
    refTitle: 'Errors, idempotency & security', refSub: 'HTTP responses, session lifetimes, request limits, and essential rules for reliable payment integrations.',
    breadcrumb: 'API documentation', methods: 'Choose your integration method', methodsSub: 'Both flows use SendFlow sessions and the same server-confirmed payment status.',
    directCard: 'Direct API', directCardSub: 'Your server controls the flow and orchestrates the experience in your application.',
    hostedCard: 'Hosted payment', hostedCardSub: 'Your server creates the session, then redirects the customer to the SendFlow hosted payment page.',
    methodLevel: 'Level', methodControl: 'Flow control', methodIntegration: 'Integration', methodAuth: 'Authentication', methodReturn: 'Payment return',
    developerLevel: 'Developer', simpleLevel: 'Simple', highControl: 'High', hostedControl: 'Limited to hosted page',
    restApi: 'REST API', sessionRedirect: 'Create a session, then redirect',
    authContract: 'Server-side secret key', returnToConfirm: 'Browser redirect is not proof',
    directGuide: 'View the direct API guide', hostedGuide: 'View the redirect guide',
    capabilitiesTitle: 'What you can do',
    capabilitySession: 'Create a payment session from your merchant server.',
    capabilityCheckout: 'Present a SendFlow-hosted payment flow to the payer.',
    capabilityDirect: 'Integrate checkout directly into your application.',
    capabilityStatus: 'Read the status of a session and payment attempt.',
    capabilityWebhook: 'Receive successful or failed payment notifications by webhook.',
    baseUrlTitle: 'Addresses',
    apiBaseUrlLabel: 'SendFlow API · SENDFLOW_API_BASE_URL',
    checkoutOriginLabel: 'Hosted payment · SENDFLOW_CHECKOUT_ORIGIN',
    merchantAppLabel: 'Merchant application',
    publicSiteLabel: 'SendFlow public site',
    documentationUrlLabel: 'API documentation',
    baseUrlPending: 'Copy each address from its block. Set the required variables on your merchant server and never put your secret key in the browser.',
    quickstartTitle: 'Quickstart',
    quickstartPrereqTitle: 'Prerequisites',
    quickstartPrereqText: 'A merchant account with API access and a SendFlow key pair. Set SENDFLOW_API_BASE_URL and SENDFLOW_SECRET_KEY in your server environment. SENDFLOW_CHECKOUT_ORIGIN is required only for Hosted Checkout.',
    quickstartCatalogTitle: 'Countries, operators, fees, and OTP policy',
    quickstartCatalogText: 'GET /pricing returns the country and operator catalog, including requiresOtp and otpCommand when configured. Filter these fields from the response; the examples dynamically display the country, operator, and instruction without a hard-coded list. If present, otpCommand is an instruction or code to dial, not the payer’s personal OTP. These metadata do not confirm a payment or LinkFlow availability: use only the choices returned by the session.',
    quickstartLimitsTitle: 'Check payment limits',
    quickstartLimitsText: 'GET /payment-limits returns the currently configured limits. The server validates the amount again when creating a session.',
    quickstartDirectTitle: 'Create a direct payment session',
    quickstartDirectText: 'Create the session from your merchant server with a fixed XOF amount and a unique Idempotency-Key for this operation. The payer cannot change the amount.',
    quickstartChoicesTitle: 'Load payment choices',
    quickstartChoicesText: 'Use the ID, public key, and token from the created session. Display only the countries and operators returned for that session.',
    quickstartAttemptTitle: 'Start a Mobile Money attempt',
    quickstartAttemptText: 'After the payer chooses a method, start the attempt with the API fields; the session fixes the amount. The operator then sends a USSD confirmation request to the payer, who approves it on their phone. Display ussdCode exactly if returned; it may be null.',
    quickstartStatusTitle: 'Check the status',
    quickstartStatusText: 'Read the session from your server with the secret key, or verify the webhook signature. Confirm the order only after a succeeded state.',
    quickstartIntegrationNote: 'Copy the addresses from the blocks above. Replace sample values with your account values and keep the secret key on your server.',
    threeSteps: 'Recommended flow', stepOne: 'Create your merchant account', stepOneSub: 'An active, eligible merchant account is required to use API payments.', stepTwo: 'Configure your API keys', stepTwoSub: 'Create or regenerate your key pair in the Developers area; the secret key is shown only when created.', stepThree: 'Integrate SendFlow into your app', stepThreeSub: 'Create sessions server-side and verify results with SendFlow.',
    read: 'Read the guide', support: 'Need help?', supportSub: 'Contact the SendFlow team with questions about your integration.', contact: 'Contact support',
    disclaimerTitle: 'Payment confirmation', disclaimer: 'Never mark an order as paid based only on a redirect or a browser-side state. Verify the server status or process a webhook whose signature is valid.',
    whatIs: 'SendFlow payments for merchants',
    whatIsText: 'SendFlow provides a payment API for integrating hosted checkout or a direct checkout, with payment operations verified server-side.',
    prerequisites: 'Prerequisites', noCredentials: 'Never place the secret key in a browser, distributed mobile app, public repository, or client-side logs.',
    notDocumented: 'API key management', notDocumentedText: 'An initial pair is created at signup and included in the account-creation response. You can create a new pair later in the Developers area; doing so immediately revokes the previous pair. Keys do not have configurable per-key permissions: SendFlow checks account status and eligibility server-side for each operation. The secret key is for private server requests; the public key is used only for direct checkout requests.',
    rotationText: 'The full secret key is returned only in the signup or key-pair creation/regeneration response; the key list shows only its prefix. Store it in a secret manager. If you lose it, regenerate the pair; the previous pair is immediately disabled.',
    serverOnly: 'Send the secret key in the Authorization: Bearer header from your server. Never pass it to the client.',
    credentialRolesTitle: 'Role and handling of each credential',
    credentialHeader: 'Credential', credentialUseHeader: 'Used for', credentialHandlingHeader: 'Handling',
    pollTokenNote: 'pollToken grants access to an attempt. Prefer checking status from your server with the secret key; if the client needs it to show progress, keep it in memory temporarily and exclude it from logs, URLs, and analytics.',
    codeLabel: 'Request example', placeholder: 'API request',
    endpointGroupNote: 'Endpoints are grouped by integration step and execution context.',
    directExamplesTitle: 'Integration steps',
    directStepCatalog: 'Step 1 · Read the catalog and limits',
    directStepCreate: 'Step 2 · Create the session on your server',
    directStepRead: 'Step 3 · Load choices for the session',
    directStepAttempt: 'Step 4 · Start the attempt in checkout',
    directStepPoll: 'Step 5 · Track progress, then verify server-side',
    directWebhookSetupTitle: 'Configure payment notifications',
    directWebhookSetupText: 'In your Developers area, add your own public HTTPS endpoint, choose the events you need, and save the signing secret shown at creation. Configure this in the merchant account; this is not a webhook-creation endpoint in the payment API. SendFlow allows up to five active endpoints per account.',
    directWebhookDeliveryText: 'Verify the signature over the raw bytes and the timestamp before parsing the event. Persist it idempotently before returning 2xx; delivery order is not guaranteed.',
    directReliabilityTitle: 'Idempotency, states, and errors',
    directReliabilityText: 'Reuse an Idempotency-Key only to retry the exact same operation. A session expires one hour after creation. created, waiting, and uncertain are not final confirmations. A create request that returns 503 before an identifier is issued creates no session or request; a 503 while reading an existing resource means its result still needs checking.',
    hostedExamplesTitle: 'Examples in payment-flow order',
    hostedStepCreate: 'Step 1 · Create the session and prepare the link',
    hostedStepStatus: 'Step 2 · Check status on your server',
    model: 'Payment flow', modelTextDirect: 'Create the session with mode direct from your server. The client then reads the public session, displays available countries and operators, starts an attempt for the fixed amount, and polls its status.',
    modelTextHosted: 'Create the session with mode hosted from your server. The API returns checkoutPath; combine it with the copied SENDFLOW_CHECKOUT_ORIGIN value, then redirect the customer.',
    apiAvailabilityTitle: 'API address',
    apiAvailabilityText: 'All requests use the address shown in the copyable “SendFlow API” block. This page describes the API contract; it does not measure live availability. Supported flows depend on the selected mode, country, operator, and choices returned by the session.',
    hostedOriginText: 'checkoutPath remains a relative path to preserve the API contract. For hosted payments and LinkFlow links, combine it with the SENDFLOW_CHECKOUT_ORIGIN value copied on your merchant server.',
    hostedFallbackText: 'After succeeded is confirmed, the page redirects to returnUrl if provided; otherwise, it returns to the SendFlow public site. The page does not redirect to returnUrl after a confirmed failure. A redirect is a user-interface signal, never proof of payment.',
    webhookSharedNote: 'Webhooks reflect server-recorded events. payout.succeeded is emitted only after verified final confirmation; see the Webhooks guide to verify signatures and deduplicate deliveries.',
    webhookGuideLink: 'Open the Webhooks guide',
    mobileMoneyTitle: 'Mobile Money and USSD confirmation',
    mobileMoneyText: 'The direct session returns available countries and operators, including requiresOtp and otpCommand when configured. For an OTP obtained before the request, send otp in the body. For an operator-started challenge, the response returns flow.action = "enter_otp" and flow.reference; repeat the same request with the same Idempotency-Key, that reference, and otp. otpCommand is an instruction to dial, never the payer’s personal OTP. For a redirect flow, follow flow.redirectUrl only when flow.action is "open_redirect"; returnUrl remains the merchant return after payment. Always verify the result using server status or the signed webhook.',
    mobileMoneyOtpTitle: 'OTP flows and USSD codes',
    mobileMoneyOtpText: 'The table gives examples of operator instructions. The operational value is always otpCommand returned by SendFlow; do not hard-code commands. For commands containing the amount, configure the template with {amount}; SendFlow replaces that token with the exact XOF amount. If the amount is variable, the exact instruction is returned with the attempt. Send the OTP only in the defined otp field.',
    mobileMoneyOtpExampleTitle: 'Attempt example using the SendFlow contract',
    mobileMoneyOtpExampleNote: 'The body uses countryCode, operatorId, and phoneNumber. For a previously obtained OTP, add otp. For an operator-started challenge, repeat the same body with the same Idempotency-Key, flow.reference, and otp. An initial response never confirms payment: verify server status or the signed webhook.',
    mobileMoneyWaveTitle: 'Wave and app handoff',
    mobileMoneyWaveText: 'When the selected flow uses a redirect, the attempt returns flow.action = "open_redirect" and the server-generated URL in flow.redirectUrl. Open that exact URL. Do not build an app link or use returnUrl instead.',
    mobileMoneyFlowsTitle: 'Flow summary',
    mobileMoneyFlowHeader: 'Flow',
    mobileMoneyResponseHeader: 'SendFlow response',
    mobileMoneyActionHeader: 'Correct action',
    mobileMoneyActorsTitle: 'Who does what in a Mobile Money payment?',
    mobileMoneyCountryTitle: 'Country flows and codes — reference values to confirm',
    mobileMoneyCountryHeader: 'Country · operator',
    mobileMoneyStatusHeader: 'Reference flow',
    mobileMoneyCodeHeader: 'Code / redirect',
    mobileMoneyDetailsHeader: 'Current SendFlow rule',
    androidDirectNote: 'The Kotlin example below uses public direct-session routes from Android. It is a REST example, not an official SDK; it assumes kotlinx-coroutines-android. Create the session on your server and pass only the public key and required session tokens to the app.',
    directInputText: 'Mind the format: the session may return a lowercase country code (for example ci), while creating an attempt requires two uppercase letters (CI). Convert it to uppercase. phoneNumber must include the international prefix returned by the session (for example +225 followed by the national number). Use operatorId directly from the session response.',
    directCorsNote: 'The /api/v1/public/* routes have their own CORS configuration: browser calls are allowed without cookies, using GET/POST/OPTIONS and Content-Type, X-SendFlow-Public-Key, X-SendFlow-Client-Token, X-LinkFlow-Attempt-Token, and Idempotency-Key. Creating a session and reading a private session with Authorization: Bearer remain server-side. Never expose the secret key in a browser.',
    hostedTimerText: 'The hosted page displays a 10-minute waiting countdown. When it expires, the payer may see a failure screen, but server-side polling continues and a later final confirmation takes precedence. The countdown is not a payment status: check the server status or a signed webhook and treat uncertain as non-final.',
    responsibilities: 'Financial integration best practices',
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
    webhookEvents: 'Webhook events', webhookEventsSub: 'Available events are payment.succeeded, payment.failed, payout.created, payout.processing, payout.succeeded, payout.failed, and payout.uncertain. Payout events are emitted only for server-recorded transitions; payout.succeeded requires verified final confirmation.',
    webhookPayloadNote: 'Payment payloads include session, attempt, and transaction identifiers. Payout payloads include the reference, amounts, fees, country, operator, and status, but no beneficiary phone number. The id matches the sendflow-delivery UUID and stays stable across retries. The same signature verification applies to both event families. Do not put personal data in merchantReference.',
    eventNames: 'Available events', delivery: 'Signatures and delivery', deliveryText: 'The HMAC-SHA256 signature is computed over the string <timestamp>.<raw JSON body>. Return HTTP 2xx to acknowledge delivery; non-2xx responses, network errors, and timeouts are retried. The request timeout is 8 seconds and response bodies are limited to 8 KB. SendFlow makes at most 8 attempts total: the initial delivery plus up to 7 retries, spaced 10 s, 30 s, 2 min, 10 min, 30 min, 2 h, and 12 h apart. The sendflow-delivery ID stays stable across retries; use it for deduplication.',
    webhookHeadersTitle: 'Request headers', webhookHeadersText: 'sendflow-event identifies the event type. sendflow-delivery contains the same UUID as payload.id and remains unchanged on retries. sendflow-signature follows t=<Unix timestamp>,v1=<hex signature>. The signature is computed over the exact received body bytes. The verification example chooses a 300-second freshness window as merchant policy; SendFlow does not set this value.',
    apiScopeTitle: 'PAYIN and PAYOUT flows', apiScopeText: 'PAYIN: the customer pays by Mobile Money; after verified final server confirmation, the net amount is credited to the merchant’s SendFlow wallet. PAYOUT: the merchant requests an outgoing transfer from the available SendFlow wallet balance to a beneficiary’s Mobile Money account. SendFlow calculates amounts, fees, and reservations server-side. The catalog and quote do not initiate a transfer; check server status and treat a payment as final only after verified confirmation.',
    endpointLimits: 'Payment limits',
    endpointLimitsDesc: 'Returns the currently configured FCFA thresholds. This public read never replaces server-side validation.',
    endpointPayout: 'PAYOUT API',
    payoutApiTitle: 'Merchant payout API',
    payoutApiText: 'A PAYOUT is an outgoing transfer from the authenticated merchant’s SendFlow wallet to a beneficiary’s Mobile Money account. Available balance is calculated after active reservations; amounts and fees are validated server-side. A quote does not reserve funds. operations.payout=true in /api/pricing describes catalog configuration, not guaranteed availability: account eligibility, routing, pricing, limits, and balance are checked for each request.',
    payoutQuoteTitle: '1. Calculate a quote',
    payoutQuoteText: 'POST /api/v1/payout-quote is read-only and does not reserve funds. Find a country and operator with operations.payout=true in /api/pricing, then send amountMinor as a whole XOF amount, lowercase countryCode, its exact operatorId, and feePayer (merchant or beneficiary). The response includes calculated amounts, available balance, limits, pricing version, and quoteExpiresAt. Missing configuration or an unavailable route can return 503.',
    payoutCreateTitle: '2. Submit a payout request',
    payoutCreateText: 'POST /api/v1/payouts requests a transfer to the beneficiary’s Mobile Money account. It requires the merchant’s active secret key in Authorization: Bearer, an Idempotency-Key (8–128 characters), country, operator, amount, currency, fee payer, and an international phone number matching the country. Keys do not have configurable per-key permissions; SendFlow checks account status and eligibility server-side for each operation. SendFlow recalculates fees and available balance; a quote does not authorize a transfer. Reuse the same key for an exact retry. If a request returns 503 or times out, check its server-side status before trying again.',
    payoutListTitle: '3. List requests',
    payoutListText: 'GET /api/v1/payouts returns only requests owned by the authenticated merchant. limit accepts 1–100 (25 by default), cursor is a UUID, and status filters by payout state.',
    payoutReadTitle: '4. Read a request',
    payoutReadText: 'GET /api/v1/payouts/{payoutId} requires the UUID of an existing request owned by the same merchant. The beneficiary phone is masked.',
    payoutCancelTitle: '5. Cancel before dispatch',
    payoutCancelText: 'POST /api/v1/payouts/{payoutId}/cancel is available only while funds are reserved and SendFlow execution has not started. After dispatch, or when the state no longer permits cancellation, the API returns 409.',
    security: 'Security & reliability', errors: 'HTTP errors', idempotency: 'Idempotency', expiration: 'Expiration and amounts', securityText: 'Use HTTPS. Store the secret key and webhook secret (shown once at creation) in a secure vault. Compare signatures in constant time, check timestamp freshness, and process events only after verification.',
    errorsText: 'The documented routes return JSON errors in the form { "error": "…" }. The contract defines no stable machine-readable error code: handle HTTP status and your own business rules, not message text. HTTP 503 means the route cannot process the request at that time; it proves neither success nor final failure. For an existing resource, read its status again or verify the signed webhook before making a decision. A redirect or browser state never confirms payment.',
    globalHttpErrors: 'A request may also return 413 when its body exceeds 100 KB, or 415 for an unsupported encoding. An unexpected server error may return 500. Responses keep the JSON shape { "error": "…" }; never infer a payment result from a 500/503 response.',
    errorEnvelopeTitle: 'Error format',
    httpErrorTableTitle: 'HTTP responses and recommended handling',
    errorStatusHeader: 'HTTP', errorMeaningHeader: 'Meaning', errorActionHeader: 'Recommended action',
    parametersTitle: 'Contract parameters', parameterFieldHeader: 'Field / location',
    parameterTypeHeader: 'Type', parameterRequirementHeader: 'Requirement', parameterDescriptionHeader: 'Description',
    noParameters: 'No request parameters or authentication are required.',
    error400: '400 — invalid body, parameters, or headers; amount, currency, mode, HTTPS URL, metadata, country, operator, or phone number does not match the contract.',
    error401: '401 — secret key missing, invalid, or revoked. Check the server-side Bearer credential; never include the secret in a client app.',
    error403: '403 — merchant account is not authorized or eligible to create API payments.',
    error404: '404 — session, attempt, or public credentials are unavailable. Invalid public credentials, an expired session, or the wrong session mode may also be hidden behind this response.',
    error409: '409 — merchant reference already used, or Idempotency-Key reused with a different body. For a retry, resend the same request with the same key; use a new key only for a new business operation.',
    error429: '429 — request limit reached. Respect Retry-After: 60, slow down status checks, and do not retry immediately.',
    error503: '503 — the operation is unavailable. The result depends on the route: if a create request is rejected before an identifier is returned, there is nothing to query; for an existing session or attempt, read its status again or verify the webhook. This status alone never proves success or final failure.',
    idempotencyText: 'For each session or attempt creation, send a stable 8–128 character Idempotency-Key with no leading or trailing spaces. A retry with the same key and body returns the same operation; reusing it with a different request returns 409. A previously used merchant reference also returns 409. Use a new key only for a new business operation.',
    expirationText: 'Sessions expire one hour after creation. After expiry, public choices and starting an attempt are unavailable. The server-side session read and status check for an already-created attempt remain possible with valid credentials. The amount is fixed in XOF and must follow the current limits returned by GET /api/payment-limits; the payer cannot change it.',
    rateLimits: 'Request limits', rateLimitsText: 'Per API key per one-minute window: 30 session creations, 120 reads, 5 direct attempts, and 60 status checks. Session creation also has a merchant-account limit of 10 per minute. Per client IP, public session reads are limited to 120 per minute, attempts to 5, and status checks to 60. Key, account, and IP quotas can apply together. A rate-limited response includes 429 and Retry-After: 60; wait before resuming.',
    statesTitle: 'Payment states', statesText: 'Session and attempt states describe payment progress; only a confirmed final state should trigger your order decision.',
    serviceAvailability: 'Addresses and status checks', serviceAvailabilityText: 'Read the status or signed webhook only for a session or attempt that was created. If creation returns 503 before an identifier is returned, there is no session to query. A browser redirect is never confirmation.',
    environmentNote: 'Addresses are shown individually in copyable blocks below.',
    troubleshootingTitle: 'Quick troubleshooting',
    hostedFlow: 'Hosted redirect flow', directFlow: 'Direct API flow', returnUrlTitle: 'Configure the post-payment return', returnUrlText: 'For each hosted session, set the optional returnUrl field in the POST /api/v1/payment-sessions JSON body to your own HTTPS return page; the copyable request above shows where to set it. This field is not SENDFLOW_CHECKOUT_ORIGIN, which is the SendFlow hosted-checkout origin. The URL can be at most 2,048 characters and cannot contain embedded credentials. Redirect happens only after a succeeded confirmation; after a confirmed failure, checkout does not redirect to returnUrl. If omitted, checkout returns to SendFlow. Always verify the server status or signed webhook: a redirect is not proof of payment.',
    language: 'Language', copyright: 'SendFlow · API documentation', lastUpdated: 'API reference v1',
    contents: 'Contents',
  },
};

const localizedLists: Record<Language, TranslationLists> = {
  fr: {
    stepTitles: ['Obtenez vos accès API', 'Choisissez votre intégration', 'Vérifiez chaque paiement'],
    stepTexts: [
      'Une paire initiale est fournie à l’inscription. Gardez la clé secrète sur votre serveur ; si elle a été perdue, régénérez la paire dans l’espace Développeurs.',
      'Choisissez Hosted Checkout pour rediriger le payeur, ou l’API directe pour garder votre propre caisse.',
      'Consultez le catalogue, créez les sessions côté serveur et vérifiez le résultat par statut ou webhook signé.',
    ],
    responsibilitiesText: [
      'Créez la session depuis votre serveur à partir de la commande de confiance. Utilisez une merchantReference unique et une Idempotency-Key stable ; pour reprendre la même opération, renvoyez la même clé avec le même corps.',
      'Gardez la clé secrète sur votre serveur. En mode direct, transmettez au client uniquement la clé publique et les jetons de session nécessaires ; n’intégrez jamais le secret dans l’application ou les journaux.',
      'Après le démarrage, le payeur reçoit une demande USSD de son opérateur et la valide sur son téléphone. Affichez ussdCode uniquement s’il est renvoyé, exactement tel quel ; la valeur peut être null.',
      'Enregistrez sessionId, attemptId et merchantReference pour le rapprochement. Traitez created, waiting et uncertain comme non finaux ; ne validez la commande qu’après un succeeded confirmé par le serveur.',
      'Vérifiez la signature HMAC sur le corps brut et l’horodatage du webhook. Dédupliquez avec sendflow-delivery et enregistrez l’événement avant d’acquitter sa réception.',
      'Respectez Retry-After après un 429, évitez les vérifications en boucle et utilisez les webhooks configurés. Un 503 de création sans identifiant ne crée aucune session ; ne concluez ni à un paiement réussi ni à un échec final sur ce seul statut.',
      'N’insérez pas de données personnelles dans merchantReference ou metadata. Limitez les données conservées dans vos journaux et ne journalisez jamais les secrets.',
    ],
    directFlowTitles: ['Préparer la commande et consulter les options', 'Créer la session', 'Afficher les choix de la session', 'Démarrer la tentative', 'Confirmer le résultat côté serveur'],
    directFlowTexts: [
      'Depuis votre serveur, consultez GET /api/pricing et GET /api/payment-limits. Ils aident à préparer la caisse, mais la session directe reste la source de vérité pour les moyens réellement proposés.',
      'Votre backend crée une session mode=direct avec un montant entier XOF, une merchantReference unique et une Idempotency-Key stable. Gardez la clé secrète hors du navigateur et de l’application mobile.',
      'La caisse appelle la lecture publique avec la clé publique et le clientToken de cette session. Présentez uniquement les pays et opérateurs retournés ; requiresOtp et otpCommand viennent de cette même réponse.',
      'Le payeur choisit un opérateur et saisit son numéro. Envoyez les champs exacts de la tentative ; si OTP est requis, suivez flow.action et transmettez le code avec les champs prévus.',
      'Vous pouvez afficher la progression de tentative avec pollToken. Votre backend doit relire la session avec la clé secrète et ne traiter la commande comme payée qu’après succeeded. waiting et uncertain restent non finaux.',
    ],
    hostedFlowTitles: ['Créer une session hébergée', 'Rediriger le client', 'Laisser le client payer', 'Confirmer côté serveur'],
    hostedFlowTexts: [
      'Marchand — votre backend crée la session avec mode=hosted, un montant fixe en XOF et une clé d’idempotence. Il reçoit checkoutPath.',
      'Votre serveur combine checkoutPath avec la valeur copiée dans SENDFLOW_CHECKOUT_ORIGIN, puis transmet l’URL complète au navigateur ou à l’application.',
      'Le payeur choisit un moyen proposé sur la page SendFlow, puis reçoit et valide la demande USSD de l’opérateur sur son téléphone. Le retour navigateur ne confirme pas le paiement.',
      'Le serveur marchand relit la session et traite les webhooks communs aux deux modes. Après succeeded confirmé, le montant net est crédité au portefeuille SendFlow du marchand ; seule la confirmation serveur valide aussi la commande.',
    ],
    mobileMoneyActors: [
      { title: 'Client payeur', body: 'Choisit un opérateur renvoyé par la session, puis suit l’instruction : confirmation sur téléphone, saisie OTP ou ouverture de la redirection serveur. Le parcours affiché suit flow.action.' },
      { title: 'Marchand', body: 'Crée la session sur son serveur, affiche les choix disponibles, démarre la tentative et interroge son état. Il n’envoie jamais la clé secrète dans le navigateur ou l’application mobile.' },
      { title: 'Réponse de l’API', body: 'La réponse comprend attemptId, state, amountMinor, currency, pollToken, ussdCode et flow. flow indique la prochaine action : confirmation téléphone, saisie OTP, ouverture de redirectUrl, attente ou aucune action.' },
      { title: 'Webhook', body: 'Pour les deux modes, SendFlow notifie payment.succeeded ou payment.failed uniquement après confirmation finale. Vérifiez la signature HMAC et dédupliquez avec sendflow-delivery.' },
    ],
    mobileMoneyOtpRows: [
      { flow: 'Politique OTP de la session', response: 'Chaque opérateur peut renvoyer requiresOtp et otpCommand. Le catalogue de la session est la source de vérité pour la caisse.', action: 'Affichez l’instruction reçue et adaptez le parcours selon flow.action.' },
      { flow: 'OTP obtenu avant la tentative', response: 'Le payeur obtient le code selon otpCommand ; le corps de tentative accepte otp.', action: 'Envoyez le code uniquement au serveur SendFlow. Ne l’enregistrez pas dans vos journaux.' },
      { flow: 'Défi OTP par l’opérateur', response: 'La première réponse peut renvoyer flow.action = enter_otp et une référence de tentative.', action: 'Reprenez la même requête, la même Idempotency-Key, flow.reference et otp.' },
      { flow: 'Redirection Wave ou opérateur', response: 'Le contrat commun prévoit flow.action = open_redirect et flow.redirectUrl lorsque l’intégration renvoie une URL.', action: 'Ouvrez exactement l’URL retournée. returnUrl est le retour marchand, pas la redirection opérateur.' },
      { flow: 'Codes par pays', response: 'La session renvoie l’instruction configurée pour chaque opérateur proposé.', action: 'Utilisez les valeurs renvoyées par la session et n’en construisez pas de nouvelles côté marchand.' },
    ],
    mobileMoneyFlowRows: [
      { flow: 'Confirmation sur téléphone (USSD Push)', response: 'Lorsque le démarrage est disponible, POST /api/v1/public/payment-sessions/{sessionId}/attempts répond HTTP 201 avec state waiting ou uncertain. ussdCode peut être null ; cette réponse ne confirme pas le paiement.', action: 'Le payeur valide la demande USSD dans le parcours de son opérateur. Vérifiez ensuite le statut côté serveur ou le webhook signé.' },
      { flow: 'Wave et ouverture d’application', response: 'Une réponse de redirection utilise flow.action = open_redirect et contient l’URL serveur dans flow.redirectUrl.', action: 'Ouvrez exactement flow.redirectUrl. returnUrl reste le retour vers le site marchand après confirmation.' },
      { flow: 'Statut du paiement', response: 'waiting et uncertain ne sont pas des états finaux.', action: 'Ne confirmez pas la commande à la réception de la demande USSD ; vérifiez le statut serveur ou le webhook signé.' },
    ],
    mobileMoneyCards: [
      { title: 'Côte d’Ivoire · Orange Money', countryCode: 'CI', status: 'OTP obtenu par USSD', code: '#144*82#', body: 'Exemple de commande : affichez la valeur otpCommand configurée et transmettez le code personnel dans otp.' },
      { title: 'Côte d’Ivoire · Wave', countryCode: 'CI', status: 'Redirection Wave', code: 'flow.redirectUrl', body: 'Ouvrez exactement l’URL renvoyée par le serveur lorsque flow.action vaut open_redirect.' },
      { title: 'Côte d’Ivoire · MTN / Moov', countryCode: 'CI', status: 'USSD Push', code: 'Pas de code fixe', body: 'Le payeur valide la demande de l’opérateur sur son téléphone ; vérifiez le statut final côté serveur.' },
      { title: 'Sénégal · Orange', countryCode: 'SN', status: 'OTP obtenu par USSD', code: '#144#391#', body: 'Exemple de commande : affichez la valeur otpCommand configurée et transmettez le code personnel dans otp.' },
      { title: 'Sénégal · Wave', countryCode: 'SN', status: 'Redirection Wave', code: 'flow.redirectUrl', body: 'Ouvrez exactement l’URL renvoyée par le serveur lorsque flow.action vaut open_redirect.' },
      { title: 'Sénégal · Free / E-money', countryCode: 'SN', status: 'USSD Push', code: 'Pas de code fixe', body: 'Le payeur valide la demande de l’opérateur sur son téléphone ; vérifiez le statut final côté serveur.' },
      { title: 'Mali · Orange', countryCode: 'ML', status: 'OTP obtenu par USSD', code: '#144#77#', body: 'Exemple de commande : affichez la valeur otpCommand configurée et transmettez le code personnel dans otp.' },
      { title: 'Mali · Moov', countryCode: 'ML', status: 'USSD Push', code: 'Pas de code fixe', body: 'Le payeur valide la demande de l’opérateur sur son téléphone ; vérifiez le statut final côté serveur.' },
      { title: 'Burkina Faso · Orange', countryCode: 'BF', status: 'OTP USSD avec montant', code: '*144*4*6*montant#', body: 'Le montant peut faire partie de la commande. Utilisez uniquement l’instruction exacte renvoyée par SendFlow.' },
      { title: 'Burkina Faso · Moov / Flooz', countryCode: 'BF', status: 'USSD Push', code: 'Pas de code fixe', body: 'Le payeur valide la demande de l’opérateur sur son téléphone ; vérifiez le statut final côté serveur.' },
      { title: 'Cameroun · MTN / Orange', countryCode: 'CM', status: 'USSD Push', code: 'Pas de code fixe', body: 'Le payeur valide la demande de l’opérateur sur son téléphone ; vérifiez le statut final côté serveur.' },
      { title: 'Congo RDC · Orange / Airtel / M-Pesa / Afrimoney', countryCode: 'CD', status: 'USSD Push', code: 'Pas de code fixe', body: 'Le payeur valide la demande de l’opérateur sur son téléphone ; vérifiez le statut final côté serveur.' },
      { title: 'Autres pays et opérateurs', status: 'Selon la configuration active', code: 'Catalogue / réponse de tentative', body: 'Cette matrice n’est pas exhaustive. Utilisez les pays et opérateurs de la session puis l’instruction réellement renvoyée par SendFlow.' },
    ],
    troubleshooting: [
      { symptom: 'Aucun pays ou opérateur ne s’affiche', action: 'Vérifiez la réponse de la session directe. Le catalogue global de frais ne garantit pas qu’un opérateur soit admissible pour cette session.' },
      { symptom: 'Une instruction OTP est affichée', action: 'Suivez operator.otpCommand, puis envoyez le code personnel dans otp selon flow.action. Ne journalisez pas ce code.' },
      { symptom: 'Aucun code USSD n’est renvoyé', action: 'ussdCode peut être null. N’inventez pas de code ; le payeur suit la demande de son opérateur, puis vous attendez la confirmation serveur.' },
      { symptom: 'Le client revient sans webhook', action: 'La redirection du navigateur n’est pas une confirmation. Lisez le statut serveur et consultez l’historique des livraisons webhook dans l’espace Développeurs.' },
      { symptom: 'Le compte à rebours hébergé expire', action: 'L’écran d’échec après 10 minutes n’est pas un état final serveur. Vérifiez la session et traitez uncertain comme non final.' },
      { symptom: 'Une création renvoie 503', action: 'Ne déduisez pas le résultat du seul statut HTTP. Réutilisez la même Idempotency-Key et vérifiez l’état côté serveur avant toute nouvelle tentative.' },
    ],
    credentialRows: [
      { credential: 'Clé secrète', usedFor: 'Authorization: Bearer pour les endpoints privés, dont la création/lecture de session et les opérations PAYOUT selon leur disponibilité.', handling: 'Format live : sfsk_live_ suivi de 43 caractères URL-safe. Serveur uniquement ; stockez-la dans un gestionnaire de secrets et ne la journalisez jamais.' },
      { credential: 'Clé publique', usedFor: 'X-SendFlow-Public-Key pour les appels de caisse du parcours direct, avec le clientToken de la session.', handling: 'Format live : sfpk_live_ suivi de 43 caractères URL-safe. Peut être transmise au client ; seule, elle ne suffit pas à accéder à une session et ne remplace jamais la clé secrète.' },
      { credential: 'clientToken', usedFor: 'X-SendFlow-Client-Token, associé à la clé publique pour lire une session directe et démarrer une tentative.', handling: '43 caractères URL-safe ; jeton limité à une session. Ne le partagez pas entre commandes et évitez de le conserver dans des journaux.' },
      { credential: 'pollToken', usedFor: 'X-LinkFlow-Attempt-Token, avec la clé publique et le clientToken, pour consulter une tentative directe.', handling: '64 caractères hexadécimaux minuscules ; identifiant d’accès limité à une tentative. Préférez le suivi serveur et ne l’exposez que temporairement si l’interface en a besoin.' },
      { credential: 'Secret de signature webhook', usedFor: 'Vérifier les notifications reçues sur votre endpoint.', handling: 'Secret distinct des clés API, affiché une seule fois à la configuration ; conservez-le côté serveur.' },
    ],
    paymentStateRows: [
      { state: 'created', meaning: 'La session existe, aucune tentative n’a encore été lancée.', action: 'Poursuivez le parcours de caisse prévu pour son mode.' },
      { state: 'waiting', meaning: 'Une tentative est en attente de confirmation.', action: 'Continuez le suivi ; ne marquez pas la commande comme payée.' },
      { state: 'uncertain', meaning: 'Le résultat n’est pas confirmé et peut encore évoluer.', action: 'Ne classez ni comme réussi ni comme échoué ; relisez le statut et attendez le résultat serveur.' },
      { state: 'succeeded', meaning: 'Le paiement a été confirmé avec succès.', action: 'Vous pouvez valider la commande après vérification côté serveur.' },
      { state: 'failed', meaning: 'Un échec final a été confirmé.', action: 'Ne livrez pas la commande ; appliquez votre parcours de nouvel essai métier.' },
    ],
    httpErrorRows: [
      { status: '400', meaning: 'Corps, paramètre ou en-tête invalide au regard du contrat de la route.', action: 'Corrigez les champs indiqués par la route concernée. Le corps d’erreur ne fournit pas de code machine stable.' },
      { status: '401', meaning: 'Clé secrète manquante, invalide ou révoquée.', action: 'Vérifiez Authorization: Bearer côté serveur et la clé active. Ne transmettez pas le secret au client.' },
      { status: '403', meaning: 'Compte marchand non autorisé ou non éligible à cette opération API.', action: 'Vérifiez l’éligibilité et les droits du compte avant de reprendre.' },
      { status: '404', meaning: 'Session, tentative ou identifiants publics introuvables ou indisponibles.', action: 'Vérifiez les UUID, le mode et les jetons associés sans supposer qu’une ressource a été supprimée.' },
      { status: '409', meaning: 'Référence marchande en conflit ou clé d’idempotence réutilisée avec un corps différent.', action: 'Pour une reprise, renvoyez exactement la même demande avec la même clé ; une nouvelle opération reçoit une nouvelle clé.' },
      { status: '429', meaning: 'Limite de requêtes atteinte.', action: 'Respectez Retry-After: 60 et ralentissez les appels.' },
      { status: '413', meaning: 'Corps de requête supérieur à la limite globale de 100 Ko.', action: 'Réduisez le corps ; les métadonnées de session sont limitées à 8 Ko.' },
      { status: '415', meaning: 'Jeu de caractères ou encodage de requête non pris en charge.', action: 'Envoyez du JSON UTF-8 avec Content-Type: application/json.' },
      { status: '500', meaning: 'Erreur serveur inattendue.', action: 'Reprenez avec la même clé d’idempotence et le même corps ; ne créez pas une nouvelle opération. Vérifiez ensuite l’état serveur et contactez SendFlow si l’erreur persiste.' },
      { status: '503', meaning: 'Service temporairement indisponible.', action: 'Ne classez pas le paiement comme échoué. Vérifiez de nouveau l’état de la session ou de la tentative.' },
    ],
  },
  en: {
    stepTitles: ['Get your API access', 'Choose your integration', 'Verify every payment'],
    stepTexts: [
      'An initial key pair is provided at signup. Keep the secret key on your server; if it is lost, regenerate the pair in the Developers area.',
      'Choose Hosted Checkout to redirect the payer, or the Direct API to keep your own checkout.',
      'Read the catalog, create sessions server-side, and verify results through status checks or signed webhooks.',
    ],
    responsibilitiesText: [
      'Create the session server-side from the trusted order. Use a unique merchantReference and a stable Idempotency-Key; retry the same operation with the same key and identical body.',
      'Keep the secret key on your server. In direct mode, pass only the public key and required session tokens to the client; never bundle the secret in the app or logs.',
      'After an attempt starts, the operator sends the payer a USSD confirmation request to approve on their phone. Display ussdCode only when returned, exactly as received; it may be null.',
      'Persist sessionId, attemptId, and merchantReference for reconciliation. Treat created, waiting, and uncertain as non-final; complete an order only after server-confirmed succeeded.',
      'Verify webhook HMAC using the raw body and timestamp. Deduplicate with sendflow-delivery and persist the event before acknowledging receipt.',
      'Respect Retry-After after 429, avoid tight polling, and use configured webhooks. A create-time 503 without an identifier creates no session; that status alone proves neither payment success nor final failure.',
      'Keep personal data out of merchantReference and metadata. Minimize retained log data and never log secrets.',
    ],
    directFlowTitles: ['Prepare the order and review options', 'Create the session', 'Display session choices', 'Start the attempt', 'Verify the result server-side'],
    directFlowTexts: [
      'From your server, read GET /api/pricing and GET /api/payment-limits. These help prepare checkout, but the direct session is the source of truth for payment methods actually offered.',
      'Your backend creates a mode=direct session with a whole XOF amount, unique merchantReference, and stable Idempotency-Key. Keep the secret key out of the browser and mobile app.',
      'Checkout reads the public session using its public key and clientToken. Display only the returned countries and operators; requiresOtp and otpCommand come from this same response.',
      'The payer chooses an operator and enters a phone number. Send the exact attempt fields; the amount remains fixed by the session. If OTP is required, follow flow.action and send the code using the defined request fields.',
      'You may show attempt progress using pollToken. Your backend should read the session with the secret key and treat the order as paid only after succeeded. waiting and uncertain are non-final.',
    ],
    hostedFlowTitles: ['Create a hosted session', 'Redirect the customer', 'Let the customer pay', 'Verify server-side'],
    hostedFlowTexts: [
      'Merchant — your backend creates the session with mode=hosted, a fixed XOF amount, and an idempotency key. It receives checkoutPath.',
      'Your server combines checkoutPath with the copied SENDFLOW_CHECKOUT_ORIGIN value, then passes the complete URL to the browser or app.',
      'The payer chooses a method on the SendFlow page, then receives and approves the operator’s USSD request on their phone. A browser return does not confirm payment.',
      'The merchant server reads the session and processes webhooks shared by both modes. After succeeded is confirmed, the net amount is credited to the merchant’s SendFlow wallet; server confirmation also completes the order.',
    ],
    mobileMoneyActors: [
      { title: 'Payer', body: 'Chooses an operator returned by the session, then follows the instruction: phone approval, OTP entry, or opening the server redirect. The checkout follows flow.action.' },
      { title: 'Merchant', body: 'Creates the session on its server, displays available choices, starts the attempt, and checks its status. Never send the secret key to a browser or mobile app.' },
      { title: 'API response', body: 'When an attempt is created, the response includes attemptId, state, amountMinor, currency, pollToken, ussdCode, and flow. flow identifies the next action: phone approval, OTP entry, opening redirectUrl, waiting, or none.' },
      { title: 'Webhook', body: 'For both modes, SendFlow sends payment.succeeded or payment.failed only after final confirmation. Verify the HMAC signature and deduplicate with sendflow-delivery.' },
    ],
    mobileMoneyOtpRows: [
      { flow: 'Session OTP policy', response: 'Each operator can return requiresOtp and otpCommand. The session catalog is the checkout source of truth.', action: 'Display the returned instruction and follow flow.action.' },
      { flow: 'OTP obtained before starting', response: 'The payer obtains a code using otpCommand; the attempt body accepts otp.', action: 'Send the code only to the SendFlow server. Do not store it in logs.' },
      { flow: 'Operator OTP challenge', response: 'The first response may return flow.action = enter_otp and an attempt reference.', action: 'Repeat the same request with the same Idempotency-Key, flow.reference, and otp.' },
      { flow: 'Wave or operator redirect', response: 'The shared contract uses flow.action = open_redirect and flow.redirectUrl when the integration returns a URL.', action: 'Open the exact returned URL. returnUrl is the merchant return, not the operator redirect.' },
      { flow: 'Country-specific codes', response: 'The session returns the configured instruction for each offered operator.', action: 'Use the session values; do not construct new commands in the merchant app.' },
    ],
    mobileMoneyFlowRows: [
      { flow: 'Phone confirmation (USSD Push)', response: 'When attempt startup is available, POST /api/v1/public/payment-sessions/{sessionId}/attempts returns HTTP 201 with state waiting or uncertain. ussdCode may be null; this response does not confirm payment.', action: 'The payer approves the operator USSD request on their phone. Then verify the server status or signed webhook.' },
      { flow: 'Wave app handoff', response: 'A redirect response uses flow.action = open_redirect and the server URL in flow.redirectUrl.', action: 'Open exactly flow.redirectUrl. returnUrl remains the merchant return after confirmation.' },
      { flow: 'Payment status', response: 'waiting and uncertain are non-final states.', action: 'Do not confirm an order when the USSD request is received; verify server status or the signed webhook.' },
    ],
    mobileMoneyCards: [
      { title: 'Côte d’Ivoire · Orange Money', countryCode: 'CI', status: 'OTP via USSD', code: '#144*82#', body: 'Example command: display configured otpCommand and send the personal code in otp.' },
      { title: 'Côte d’Ivoire · Wave', countryCode: 'CI', status: 'Wave redirect', code: 'flow.redirectUrl', body: 'Open exactly the URL returned by the server when flow.action is open_redirect.' },
      { title: 'Côte d’Ivoire · MTN / Moov', countryCode: 'CI', status: 'USSD Push', code: 'No fixed code', body: 'The payer approves the operator request on their phone; verify the final status server-side.' },
      { title: 'Senegal · Orange', countryCode: 'SN', status: 'OTP via USSD', code: '#144#391#', body: 'Example command: display configured otpCommand and send the personal code in otp.' },
      { title: 'Senegal · Wave', countryCode: 'SN', status: 'Wave redirect', code: 'flow.redirectUrl', body: 'Open exactly the URL returned by the server when flow.action is open_redirect.' },
      { title: 'Senegal · Free / E-money', countryCode: 'SN', status: 'USSD Push', code: 'No fixed code', body: 'The payer approves the operator request on their phone; verify the final status server-side.' },
      { title: 'Mali · Orange', countryCode: 'ML', status: 'OTP via USSD', code: '#144#77#', body: 'Example command: display configured otpCommand and send the personal code in otp.' },
      { title: 'Mali · Moov', countryCode: 'ML', status: 'USSD Push', code: 'No fixed code', body: 'The payer approves the operator request on their phone; verify the final status server-side.' },
      { title: 'Burkina Faso · Orange', countryCode: 'BF', status: 'OTP USSD with amount', code: '*144*4*6*amount#', body: 'The amount may be part of the command. Use only the exact instruction returned by SendFlow.' },
      { title: 'Burkina Faso · Moov / Flooz', countryCode: 'BF', status: 'USSD Push', code: 'No fixed code', body: 'The payer approves the operator request on their phone; verify the final status server-side.' },
      { title: 'Cameroon · MTN / Orange', countryCode: 'CM', status: 'USSD Push', code: 'No fixed code', body: 'The payer approves the operator request on their phone; verify the final status server-side.' },
      { title: 'DR Congo · Orange / Airtel / M-Pesa / Afrimoney', countryCode: 'CD', status: 'USSD Push', code: 'No fixed code', body: 'The payer approves the operator request on their phone; verify the final status server-side.' },
      { title: 'Other countries and operators', status: 'Depends on active configuration', code: 'Catalog / attempt response', body: 'This matrix is not exhaustive. Use the countries and operators from the session and the instruction actually returned by SendFlow.' },
    ],
    troubleshooting: [
      { symptom: 'No country or operator is displayed', action: 'Check the direct session response. The global fee catalog does not guarantee that a method is eligible for this session.' },
      { symptom: 'An OTP instruction is displayed', action: 'Follow operator.otpCommand, then send the personal code in otp according to flow.action. Do not log the code.' },
      { symptom: 'No USSD code is returned', action: 'ussdCode may be null. Do not invent one; the payer follows the operator request, and your app waits for server confirmation.' },
      { symptom: 'The customer returns but no webhook arrives', action: 'A browser redirect is not confirmation. Read the server status and check webhook delivery history in the Developers area.' },
      { symptom: 'The hosted countdown expires', action: 'The failure screen after 10 minutes is not a final server state. Check the session and treat uncertain as non-final.' },
      { symptom: 'A create request returns 503', action: 'Do not infer the result from the HTTP status alone. Reuse the same Idempotency-Key and check server status before trying again.' },
    ],
    credentialRows: [
      { credential: 'Secret key', usedFor: 'Authorization: Bearer for private endpoints, including session creation/reading and PAYOUT operations subject to availability.', handling: 'Live format: sfsk_live_ followed by 43 URL-safe characters. Server only. Store it in a secrets manager and never log it.' },
      { credential: 'Public key', usedFor: 'X-SendFlow-Public-Key for direct checkout requests, paired with that session’s clientToken.', handling: 'Live format: sfpk_live_ followed by 43 URL-safe characters. May be sent to the client; by itself it cannot access a session and never replaces the secret key.' },
      { credential: 'clientToken', usedFor: 'X-SendFlow-Client-Token, paired with the public key to read a direct session and start an attempt.', handling: '43 URL-safe characters; session-scoped token. Do not reuse across orders or place it in logs.' },
      { credential: 'pollToken', usedFor: 'X-LinkFlow-Attempt-Token, together with the public key and clientToken, to read a direct attempt.', handling: '64 lowercase hexadecimal characters; attempt-scoped access credential. Prefer server-side polling; expose it only temporarily if the interface requires it.' },
      { credential: 'Webhook signing secret', usedFor: 'Verify notifications received by your endpoint.', handling: 'Separate from API keys and shown only once during setup; keep it server-side.' },
    ],
    paymentStateRows: [
      { state: 'created', meaning: 'The session exists; no attempt has started.', action: 'Continue with the checkout flow for its mode.' },
      { state: 'waiting', meaning: 'An attempt is awaiting confirmation.', action: 'Continue checking; do not mark the order as paid.' },
      { state: 'uncertain', meaning: 'The result is not confirmed and may still change.', action: 'Treat as neither success nor failure; re-read status and wait for server confirmation.' },
      { state: 'succeeded', meaning: 'Payment has been confirmed successfully.', action: 'You may fulfill the order after server-side verification.' },
      { state: 'failed', meaning: 'A final failure has been confirmed.', action: 'Do not fulfill the order; use your business retry flow.' },
    ],
    httpErrorRows: [
      { status: '400', meaning: 'Request body, parameter, or header does not match the route contract.', action: 'Correct the fields for the route. The error body does not provide a stable machine-readable code.' },
      { status: '401', meaning: 'Secret key is missing, invalid, or revoked.', action: 'Check the server-side Authorization: Bearer credential and active key. Never expose the secret to the client.' },
      { status: '403', meaning: 'Merchant account is not authorized or eligible for this API operation.', action: 'Check merchant account status and eligibility before retrying.' },
      { status: '404', meaning: 'Session, attempt, or public credentials are unknown or unavailable.', action: 'Check UUIDs, mode, and associated tokens; do not assume the resource was deleted.' },
      { status: '409', meaning: 'Merchant reference conflict or an idempotency key reused with a different body.', action: 'For a retry, resend the exact request with the same key; use a new key for a new operation.' },
      { status: '429', meaning: 'Request limit reached.', action: 'Respect Retry-After: 60 and reduce request frequency.' },
      { status: '413', meaning: 'Request body exceeds the global 100 KB limit.', action: 'Reduce the body; session metadata is limited to 8 KB.' },
      { status: '415', meaning: 'Request charset or encoding is unsupported.', action: 'Send UTF-8 JSON with Content-Type: application/json.' },
      { status: '500', meaning: 'Unexpected server error.', action: 'Retry with the same idempotency key and body; do not create a new operation. Then check the server status and contact SendFlow if the error persists.' },
      { status: '503', meaning: 'Service temporarily unavailable.', action: 'Do not mark the payment as failed. Check the session or attempt status again.' },
    ],
  },
};

const apiEndpointInventory = [
  {
    method: 'POST', path: '/api/v1/payment-sessions', description: 'endpointCreate', access: 'accessServerSecret', example: 'create-hosted',
    anchor: 'create-session',
    fieldsFr: [
      { field: 'Authorization', type: 'En-tête · Bearer', requirement: 'Requis', description: 'Clé secrète du marchand ; serveur uniquement.' },
      { field: 'Idempotency-Key', type: 'En-tête · chaîne', requirement: 'Requis', description: '8 à 128 caractères ; identique lors d’une reprise exacte.' },
      { field: 'Content-Type', type: 'En-tête · chaîne', requirement: 'Requis', description: 'application/json.' },
      { field: 'merchantReference', type: 'Chaîne', requirement: 'Requis · corps', description: 'Référence unique fournie par le marchand, 1 à 128 caractères.' },
      { field: 'amountMinor', type: 'Entier', requirement: 'Requis · corps', description: 'Montant fixe dans la plage actuellement renvoyée par GET /api/payment-limits.' },
      { field: 'currency', type: 'Chaîne', requirement: 'Requis · corps', description: 'Valeur acceptée : XOF.' },
      { field: 'mode', type: 'Chaîne', requirement: 'Requis · corps', description: 'hosted ou direct.' },
      { field: 'description', type: 'Chaîne', requirement: 'Facultatif · corps', description: '240 caractères maximum.' },
      { field: 'returnUrl', type: 'URL ou null', requirement: 'Facultatif · corps', description: 'URL HTTPS ; utilisée par le parcours hébergé après confirmation réussie.' },
      { field: 'metadata', type: 'Objet JSON', requirement: 'Facultatif · corps', description: 'Données complémentaires limitées à 8 Ko ; n’y placez pas de données sensibles.' },
    ],
    fieldsEn: [
      { field: 'Authorization', type: 'Header · Bearer', requirement: 'Required', description: 'Merchant secret key; server only.' },
      { field: 'Idempotency-Key', type: 'Header · string', requirement: 'Required', description: '8–128 characters; reuse for an exact retry.' },
      { field: 'Content-Type', type: 'Header · string', requirement: 'Required', description: 'application/json.' },
      { field: 'merchantReference', type: 'String', requirement: 'Required · body', description: 'Unique merchant-supplied reference, 1–128 characters.' },
      { field: 'amountMinor', type: 'Integer', requirement: 'Required · body', description: 'Fixed amount within the current range returned by GET /api/payment-limits.' },
      { field: 'currency', type: 'String', requirement: 'Required · body', description: 'Accepted value: XOF.' },
      { field: 'mode', type: 'String', requirement: 'Required · body', description: 'hosted or direct.' },
      { field: 'description', type: 'String', requirement: 'Optional · body', description: 'Maximum 240 characters.' },
      { field: 'returnUrl', type: 'URL or null', requirement: 'Optional · body', description: 'HTTPS URL; used by hosted checkout after successful confirmation.' },
      { field: 'metadata', type: 'JSON object', requirement: 'Optional · body', description: 'Additional data limited to 8 KB; do not put sensitive data here.' },
    ],
    codesFr: 'HTTP : 201, 400, 401, 403, 409, 429, 503.',
    codesEn: 'HTTP: 201, 400, 401, 403, 409, 429, 503.',
    errorsFr: '400 : corps ou en-têtes invalides, limites de champs ou métadonnées dépassées. 401 : clé secrète absente, invalide ou révoquée. 403 : compte marchand non éligible. 409 : clé d’idempotence réutilisée avec un autre corps ou référence marchande déjà utilisée. 429 : quota dépassé. 503 : service temporairement indisponible ; la création n’est pas confirmée.',
    errorsEn: '400: invalid body or headers, field limits, or oversized metadata. 401: missing, invalid, or revoked secret key. 403: merchant account not eligible. 409: idempotency key reused with a different body or merchant reference already used. 429: quota exceeded. 503: service temporarily unavailable; the session was not confirmed.',
    requirementsFr: 'En-têtes : Authorization: Bearer <clé secrète>, Idempotency-Key (8–128 caractères, sans espaces en début/fin), Content-Type: application/json. Requis : merchantReference (1–128), amountMinor (entier XOF dans la plage configurée, à lire via GET /api/payment-limits), currency=XOF, mode=hosted|direct. Facultatifs : description (240 caractères max), returnUrl (URL HTTPS utilisée uniquement par le parcours hosted après confirmation succeeded), metadata (8 Ko max). Expiration : 1 heure.',
    requirementsEn: 'Headers: Authorization: Bearer <secret key>, Idempotency-Key (8–128 characters, no leading/trailing spaces), Content-Type: application/json. Required: merchantReference (1–128), amountMinor (integer XOF within the configured range, read it from GET /api/payment-limits), currency=XOF, mode=hosted|direct. Optional: description (max 240 characters), returnUrl (HTTPS URL used only by hosted flow after succeeded confirmation), metadata (max 8 KB). Expires after 1 hour.',
    response: `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "merchantReference": "ORDER-2026-0042",
  "mode": "hosted",
  "state": "created",
  "amountMinor": 12500,
  "currency": "XOF",
  "checkoutPath": "/pay/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "clientToken": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  "publicKey": "sfpk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "expiresAt": "2026-10-29T11:30:00.000Z"
}`,
  },
  {
    method: 'GET', path: '/api/v1/payment-sessions/{sessionId}', description: 'endpointRead', access: 'accessServerSecretRead', example: 'read-session',
    anchor: 'read-session',
    fieldsFr: [
      { field: 'sessionId', type: 'UUID · chemin', requirement: 'Requis', description: 'Identifiant id renvoyé lors de la création de la session.' },
      { field: 'Authorization', type: 'En-tête · Bearer', requirement: 'Requis', description: 'Clé secrète du marchand ; serveur uniquement.' },
    ],
    fieldsEn: [
      { field: 'sessionId', type: 'UUID · path', requirement: 'Required', description: 'The id returned when the session was created.' },
      { field: 'Authorization', type: 'Header · Bearer', requirement: 'Required', description: 'Merchant secret key; server only.' },
    ],
    codesFr: 'HTTP : 200, 401, 403, 404, 429, 503.',
    codesEn: 'HTTP: 200, 401, 403, 404, 429, 503.',
    errorsFr: '401 : clé secrète invalide ou révoquée. 403 : compte non autorisé. 404 : UUID ou session inconnus. 429 : quota de lectures dépassé. 503 : lecture serveur momentanément indisponible.',
    errorsEn: '401: invalid or revoked secret key. 403: account not authorized. 404: unknown UUID or session. 429: read quota exceeded. 503: server-side read temporarily unavailable.',
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
    anchor: 'direct-choices',
    fieldsFr: [
      { field: 'sessionId', type: 'UUID · chemin', requirement: 'Requis', description: 'Identifiant de la session en mode direct.' },
      { field: 'X-SendFlow-Public-Key', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Format live : sfpk_live_ suivi de 43 caractères URL-safe.' },
      { field: 'X-SendFlow-Client-Token', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Jeton de cette session : 43 caractères URL-safe.' },
    ],
    fieldsEn: [
      { field: 'sessionId', type: 'UUID · path', requirement: 'Required', description: 'Identifier for a direct-mode session.' },
      { field: 'X-SendFlow-Public-Key', type: 'Header · string', requirement: 'Required', description: 'Live format: sfpk_live_ followed by 43 URL-safe characters.' },
      { field: 'X-SendFlow-Client-Token', type: 'Header · string', requirement: 'Required', description: 'Session token: 43 URL-safe characters.' },
    ],
    codesFr: 'HTTP : 200, 404, 429, 503.',
    codesEn: 'HTTP: 200, 404, 429, 503.',
    errorsFr: '404 : identifiants publics invalides, session inconnue/expirée, lien inactif ou mode différent de direct. 429 : quota par clé ou adresse IP dépassé. 503 : session ou choix de paiement momentanément indisponibles.',
    errorsEn: '404: invalid public credentials, unknown/expired session, inactive link, or mode other than direct. 429: key or client-IP quota exceeded. 503: session or payment choices temporarily unavailable.',
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
       "operators": [{
         "id": "<operator-id>", "name": "<operator-name>", "initials": "OP", "logoUrl": null,
         "requiresOtp": false, "otpMethod": null, "otpCommand": null
       }]
    }
  ]
}`,
  },
  {
    method: 'POST', path: '/api/v1/public/payment-sessions/{sessionId}/attempts', description: 'endpointAttempt', access: 'accessPublicAttempt', example: 'start-attempt',
    anchor: 'create-attempt',
    fieldsFr: [
      { field: 'sessionId', type: 'UUID · chemin', requirement: 'Requis', description: 'Identifiant de la session directe.' },
      { field: 'X-SendFlow-Public-Key', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Clé publique de l’espace marchand.' },
      { field: 'X-SendFlow-Client-Token', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Jeton renvoyé pour cette session.' },
      { field: 'Idempotency-Key', type: 'En-tête · chaîne', requirement: 'Requis', description: '8 à 128 caractères ; même clé pour reprendre la même tentative.' },
      { field: 'firstName', type: 'Chaîne', requirement: 'Requis · corps', description: '1 à 80 caractères.' },
      { field: 'lastName', type: 'Chaîne', requirement: 'Requis · corps', description: '1 à 80 caractères.' },
      { field: 'countryCode', type: 'Chaîne', requirement: 'Requis · corps', description: 'Code pays à deux lettres majuscules, par exemple CI.' },
      { field: 'operatorId', type: 'Chaîne', requirement: 'Requis · corps', description: 'Identifiant exact d’un opérateur renvoyé pour la session, 1 à 80 caractères.' },
      { field: 'phoneNumber', type: 'Chaîne', requirement: 'Requis · corps', description: '6 à 20 caractères ; inclure l’indicatif international phonePrefix renvoyé.' },
      { field: 'otp', type: 'Chaîne', requirement: 'Facultatif · corps', description: 'Code OTP fourni par le payeur, 4 à 12 chiffres. Envoyé au serveur sans stockage durable.' },
      { field: 'reference', type: 'UUID', requirement: 'Facultatif · corps', description: 'Référence flow.reference renvoyée lorsqu’un défi OTP doit être confirmé.' },
    ],
    fieldsEn: [
      { field: 'sessionId', type: 'UUID · path', requirement: 'Required', description: 'Identifier for the direct session.' },
      { field: 'X-SendFlow-Public-Key', type: 'Header · string', requirement: 'Required', description: 'Public key for the merchant account.' },
      { field: 'X-SendFlow-Client-Token', type: 'Header · string', requirement: 'Required', description: 'Token returned for this session.' },
      { field: 'Idempotency-Key', type: 'Header · string', requirement: 'Required', description: '8–128 characters; reuse to retry the same attempt.' },
      { field: 'firstName', type: 'String', requirement: 'Required · body', description: '1–80 characters.' },
      { field: 'lastName', type: 'String', requirement: 'Required · body', description: '1–80 characters.' },
      { field: 'countryCode', type: 'String', requirement: 'Required · body', description: 'Two uppercase country letters, for example CI.' },
      { field: 'operatorId', type: 'String', requirement: 'Required · body', description: 'Exact operator ID returned for the session, 1–80 characters.' },
      { field: 'phoneNumber', type: 'String', requirement: 'Required · body', description: '6–20 characters; include the returned international phonePrefix.' },
      { field: 'otp', type: 'String', requirement: 'Optional · body', description: 'Payer-provided OTP, 4–12 digits. Sent to the server and not durably stored.' },
      { field: 'reference', type: 'UUID', requirement: 'Optional · body', description: 'flow.reference returned when an OTP challenge must be confirmed.' },
    ],
    codesFr: 'HTTP : 201, 400, 404, 409, 429, 503.',
    codesEn: 'HTTP: 201, 400, 404, 409, 429, 503.',
    errorsFr: '400 : corps invalide, pays/opérateur non proposé, numéro non conforme ou erreur OTP. otp_required renvoie flow.otpCommand si une instruction est configurée. 404 : session ou identifiants publics indisponibles. 409 : tentative ou clé d’idempotence en conflit. 429 : quota dépassé. 503 : exécution temporairement indisponible ; aucun résultat final n’est renvoyé.',
    errorsEn: '400: invalid body, country/operator not offered, invalid phone number, or OTP error. otp_required returns flow.otpCommand when configured. 404: session or public credentials unavailable. 409: attempt or idempotency conflict. 429: quota exceeded. 503: execution temporarily unavailable; no final result is returned.',
    requirementsFr: 'Paramètre : sessionId (UUID). En-têtes : X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128 caractères). Corps : firstName, lastName, countryCode, operatorId et phoneNumber. Ajoutez otp pour les opérateurs concernés ; après un défi, ajoutez aussi reference avec la même Idempotency-Key. Le montant est celui de la session.',
    requirementsEn: 'Parameter: sessionId (UUID). Headers: X-SendFlow-Public-Key, X-SendFlow-Client-Token, Idempotency-Key (8–128 characters). Body: firstName, lastName, countryCode, operatorId, and phoneNumber. Add otp for OTP operators; after a challenge, also send reference with the same Idempotency-Key. The session amount is fixed.',
    response: `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0042",
  "flow": {
    "action": "approve_on_phone",
    "reference": null,
    "otpMethod": null,
    "otpCommand": null,
    "redirectUrl": null
  }
}`,
  },
  {
    method: 'GET', path: '/api/v1/public/payment-sessions/{sessionId}/attempts/{attemptId}', description: 'endpointAttemptRead', access: 'accessAttemptRead', example: 'poll-attempt',
    anchor: 'read-attempt',
    fieldsFr: [
      { field: 'sessionId', type: 'UUID · chemin', requirement: 'Requis', description: 'Identifiant de la session.' },
      { field: 'attemptId', type: 'UUID · chemin', requirement: 'Requis', description: 'Identifiant de tentative renvoyé au démarrage.' },
      { field: 'X-SendFlow-Public-Key', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Clé publique du marchand.' },
      { field: 'X-SendFlow-Client-Token', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Jeton associé à la session.' },
      { field: 'X-LinkFlow-Attempt-Token', type: 'En-tête · chaîne', requirement: 'Requis', description: 'Valeur pollToken renvoyée au démarrage de la tentative.' },
    ],
    fieldsEn: [
      { field: 'sessionId', type: 'UUID · path', requirement: 'Required', description: 'Session identifier.' },
      { field: 'attemptId', type: 'UUID · path', requirement: 'Required', description: 'Attempt identifier returned when it was started.' },
      { field: 'X-SendFlow-Public-Key', type: 'Header · string', requirement: 'Required', description: 'Merchant public key.' },
      { field: 'X-SendFlow-Client-Token', type: 'Header · string', requirement: 'Required', description: 'Token associated with the session.' },
      { field: 'X-LinkFlow-Attempt-Token', type: 'Header · string', requirement: 'Required', description: 'pollToken returned when the attempt started.' },
    ],
    codesFr: 'HTTP : 200, 404, 429, 503.',
    codesEn: 'HTTP: 200, 404, 429, 503.',
    errorsFr: '404 : session, tentative ou jeton d’accès indisponible. 429 : quota de vérification par clé ou adresse IP dépassé. 503 : vérification serveur indisponible ; conservez waiting/uncertain comme états non finaux.',
    errorsEn: '404: session, attempt, or access token unavailable. 429: key or client-IP status-check quota exceeded. 503: server verification unavailable; keep waiting/uncertain as non-final states.',
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
  "merchantReference": "ORDER-2026-0042",
  "flow": {
    "action": "wait",
    "reference": null,
    "otpMethod": null,
    "otpCommand": null,
    "redirectUrl": null
  }
}`,
  },
  {
    method: 'GET', path: '/api/pricing', description: 'endpointPricing', access: 'accessPublic', example: 'pricing',
    anchor: 'pricing-catalog',
    fieldsFr: [
      { field: 'Paramètres', type: '—', requirement: 'Aucun', description: 'Aucune authentification ni paramètre de requête requis.' },
    ],
    fieldsEn: [
      { field: 'Parameters', type: '—', requirement: 'None', description: 'No authentication or query parameters required.' },
    ],
    codesFr: 'HTTP : 200, 503.',
    codesEn: 'HTTP: 200, 503.',
    errorsFr: '503 : catalogue ou configuration tarifaire momentanément indisponible. Les taux affichés ne garantissent pas qu’un opérateur soit proposé dans une session ni qu’un paiement puisse être exécuté.',
    errorsEn: '503: catalog or fee configuration temporarily unavailable. Published rates do not guarantee that an operator will be offered in a session or that a payment can be executed.',
    requirementsFr: 'Aucun en-tête d’authentification. fees.linkflow est un taux décimal (0,025 signifie 2,5 %). Les taux non configurés sont omis ; les valeurs présentées sont des données d’exemple.',
    requirementsEn: 'No authentication header. fees.linkflow is a decimal rate (0.025 means 2.5%). Unconfigured rates are omitted; displayed values are sample data.',
    response: `{
  "categories": [
    { "id": "deposit", "label": "Dépôt", "shortLabel": "Dépôt", "description": "Alimenter votre wallet SendFlow" },
    { "id": "inter-network", "label": "Transfert inter réseau", "shortLabel": "Inter réseau", "description": "Transférer entre deux réseaux" },
    { "id": "international", "label": "Transfert international", "shortLabel": "International", "description": "Envoyer vers un autre pays" },
    { "id": "linkflow", "label": "Paiement par lien LinkFlow", "shortLabel": "LinkFlow", "description": "Paiement via un lien LinkFlow" },
    { "id": "payout", "label": "Versement marchand", "shortLabel": "Payout", "description": "Décaissement API vers un bénéficiaire" }
  ],
  "countries": [{
    "id": "ci", "name": "Côte d’Ivoire", "dialCode": "+225", "initials": "CI",
    "flag": "🇨🇮", "enabled": true, "minPhoneDigits": 10, "maxPhoneDigits": 10,
    "operations": { "deposit": true, "interNetwork": true, "international": true, "payout": false }
  }],
  "operators": [{
    "id": "<operator-id>", "countryId": "ci", "name": "Opérateur Exemple",
    "shortName": "Exemple", "initials": "OP", "brand": "generic",
    "logoUrl": null, "requiresOtp": false, "otpCommand": null,
      "operations": { "deposit": true, "interNetwork": true, "international": true, "payout": false },
    "fees": { "linkflow": 0.025 }
  }]
}`,
  },
  {
    method: 'GET', path: '/api/payment-limits', description: 'endpointLimitsDesc', access: 'accessPublic', example: 'payment-limits',
    anchor: 'payment-limits',
    fieldsFr: [
      { field: 'Paramètres', type: '—', requirement: 'Aucun', description: 'Aucune authentification ni paramètre de requête requis.' },
      { field: 'minimumDepositMinor', type: 'Entier · XOF', requirement: 'Réponse', description: 'Minimum de dépôt configuré, en unités FCFA entières.' },
      { field: 'minimumPayoutMinor', type: 'Entier · XOF', requirement: 'Réponse', description: 'Seuil minimum indiqué pour les retraits SendFlow ; il ne constitue pas une opération API de retrait.' },
      { field: 'minimumInterNetworkMinor', type: 'Entier · XOF', requirement: 'Réponse', description: 'Minimum du transfert inter-réseaux.' },
      { field: 'maximumTransferMinor', type: 'Entier · XOF', requirement: 'Réponse', description: 'Maximum technique configuré pour les opérations de transfert.' },
      { field: 'maximumPayinMinor', type: 'Entier · XOF', requirement: 'Réponse', description: 'Maximum technique configuré pour les paiements entrants.' },
    ],
    fieldsEn: [
      { field: 'Parameters', type: '—', requirement: 'None', description: 'No authentication or query parameters required.' },
      { field: 'minimumDepositMinor', type: 'Integer · XOF', requirement: 'Response', description: 'Configured minimum deposit, in whole FCFA units.' },
      { field: 'minimumPayoutMinor', type: 'Integer · XOF', requirement: 'Response', description: 'Minimum shown for SendFlow payouts; it is not a merchant payout API operation.' },
      { field: 'minimumInterNetworkMinor', type: 'Integer · XOF', requirement: 'Response', description: 'Minimum inter-network transfer amount.' },
      { field: 'maximumTransferMinor', type: 'Integer · XOF', requirement: 'Response', description: 'Configured technical ceiling for transfer operations.' },
      { field: 'maximumPayinMinor', type: 'Integer · XOF', requirement: 'Response', description: 'Configured technical ceiling for incoming payments.' },
    ],
    codesFr: 'HTTP : 200, 503.',
    codesEn: 'HTTP: 200, 503.',
    errorsFr: '503 : limites de paiement temporairement indisponibles. Réessayez plus tard ; ne supposez pas que les valeurs ont changé.',
    errorsEn: '503: payment limits are temporarily unavailable. Retry later; do not assume the values have changed.',
    requirementsFr: 'Lecture publique, sans clé API. Les valeurs sont informatives ; chaque opération est validée à nouveau côté serveur. Tous les montants sont des entiers XOF/FCFA. La réponse d’exemple affiche les valeurs initiales : la réponse active de cette route est la référence.',
    requirementsEn: 'Public read; no API key. Values are informational; every operation is validated again on the server. Amounts are whole XOF/FCFA units. The sample response shows initial values; the live endpoint response is authoritative.',
    response: `{
  "currency": "XOF",
  "minimumDepositMinor": 200,
  "minimumPayoutMinor": 200,
  "minimumInterNetworkMinor": 1,
  "maximumTransferMinor": 10000000,
  "maximumPayinMinor": 2000000
}`,
  },
] as const;

const apiEndpointGroups: { key: string; anchors: string[] }[] = [
  { key: 'endpointGroupSessions', anchors: ['create-session', 'read-session'] },
  { key: 'endpointGroupDirect', anchors: ['direct-choices', 'create-attempt', 'read-attempt'] },
  { key: 'endpointGroupCatalog', anchors: ['pricing-catalog', 'payment-limits'] },
];

const docSearchTerms: Record<string, string> = {
  '/docs': 'accueil home intégration paiements payment',
  '/docs/getting-started': 'prérequis compte marchand étapes getting started',
  '/docs/authentication': 'clé api publique secrète bearer authentification credentials',
  '/docs/integrations/direct': `api directe session tentative paiement mobile money pays opérateurs montant statut countryCode operatorId phoneNumber ussdCode OTP USSD Kotlin Côte d’Ivoire Burkina Faso Orange Money payout payout-quote payout-create payout-list payout-read payout-cancel retrait versement sortant ${apiEndpointInventory.map((endpoint) => `${endpoint.method} ${endpoint.path} ${endpoint.description}`).join(' ')} frais limites idempotence`,
  '/docs/integrations/hosted': 'redirection hébergée checkout page payment link checkoutPath returnUrl compte à rebours client paiement Hosted Checkout',
  '/docs/webhooks': 'webhook événements notifications signature retries livraisons payment.succeeded payment.failed payout.created payout.processing payout.succeeded payout.failed payout.uncertain HMAC',
  '/docs/reference': 'erreurs idempotence expiration sécurité limites payout retrait 400 401 403 404 409 429 503 Retry-After environnement XOF uncertain',
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
  "checkoutPath": "/pay/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "clientToken": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  "publicKey": "sfpk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
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
  "clientToken": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  "publicKey": "sfpk_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
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
  "merchantReference": "ORDER-2026-0043",
  "flow": {
    "action": "approve_on_phone",
    "reference": null,
    "otpMethod": null,
    "otpCommand": null,
    "redirectUrl": null
  }
}`;

const directOtpRequiredResponse = `{
  "error": "otp_required",
  "message": "Un code OTP est requis. Obtenez-le selon l’instruction de l’opérateur, puis relancez la tentative avec le champ otp.",
  "reference": null,
  "flow": {
    "action": "enter_otp",
    "reference": null,
    "otpMethod": "ussd",
    "otpCommand": "#144*82#",
    "redirectUrl": null
  }
}`;

const directOtpChallengeResponse = `{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "waiting",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": "#144*82#",
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043",
  "flow": {
    "action": "enter_otp",
    "reference": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
    "otpMethod": "ussd",
    "otpCommand": "#144*82#",
    "redirectUrl": null
  }
}`;

function ResponsePanel({ language, label, response, caption }: { language: Language; label: string; response: string; caption?: string }) {
  const [copied, setCopied] = useState(false);
  const shownResponse = response;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shownResponse);
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
      <pre><code>{renderHighlightedCode(shownResponse)}</code></pre>
      <div className="sf-docs-code-note">{caption ?? (language === 'fr' ? 'JSON · données d’exemple' : 'JSON · sample data')}</div>
    </div>
  );
}

function CopyableUrlBlock({ language, label, value }: { language: Language; label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="sf-docs-code sf-docs-url-block" data-testid="panel-copyable-url">
      <div className="sf-docs-code-head">
        <span className="sf-docs-code-label">{label}</span>
        <button type="button" className="sf-docs-copy" onClick={() => void copy()} data-testid="button-copy-url">
          {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}
        </button>
      </div>
      <pre className="sf-docs-url-value"><code>{value}</code></pre>
    </div>
  );
}

function CodePanel({ language, label, example }: { language: Language; label: string; example: DocsExampleId }) {
  const formats = getDocsCodeFormats(example);
  const [format, setFormat] = useState<DocsCodeFormat>(() => formats[0] ?? 'cURL');
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
    </div>
  );
}

export default function DocsPage() {
  const [path, setLocation] = useLocation();
  const [language, setLanguage] = useState<Language>('fr');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDocSection, setSelectedDocSection] = useState<{ path: string; section: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([...docGroups.map((group) => group.id), 'resources']));
  const resolvedPageKey = getDocumentationPageKey(path);
  const pageKey = resolvedPageKey ?? 'home';
  const activeDocSection = selectedDocSection?.path === path ? selectedDocSection.section : '';
  const t = localized[language];
  const filteredItems = useMemo(() => docsItems.filter((item) =>
    `${localized[language][item.key] ?? item.label} ${item.label} ${item.search ?? docSearchTerms[item.path] ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [language, query]);
  useEffect(() => {
    if (path === '/docs/api-reference') setLocation('/docs/integrations/direct', { replace: true });
  }, [path, setLocation]);
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
  useEffect(() => {
    const syncSelectedSection = () => {
      const section = window.location.hash.slice(1);
      const exists = docsItems.some((item) => item.path === path && item.section === section);
      setSelectedDocSection(section && exists ? { path, section } : null);
    };
    syncSelectedSection();
    window.addEventListener('hashchange', syncSelectedSection);
    window.addEventListener('popstate', syncSelectedSection);
    return () => {
      window.removeEventListener('hashchange', syncSelectedSection);
      window.removeEventListener('popstate', syncSelectedSection);
    };
  }, [path]);
  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };
  const isDocItemActive = (item: DocItem) => {
    return item.path === path && (item.section ?? '') === activeDocSection;
  };
  const handleDocItemClick = (item: DocItem) => {
    setSidebarOpen(false);
    setSelectedDocSection(item.section ? { path: item.path, section: item.section } : null);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 50);
  };
  const titleKey = `${pageKey}Title`;
  const activeDocItem = docsItems.find((item) => item.path === path && item.section === activeDocSection);
  const activeDocGroup = docGroups.find((group) =>
    docsItems.some((item) => item.path === path && item.group === group.id),
  );
  const description = pageKey === 'start'
    ? t.startSub
    : activeDocItem
      ? t.sectionPageIntro
      : (t[`${pageKey}Sub`] ?? t.homeSub);
  const title = pageKey === 'start'
    ? t.startWelcomeTitle
    : activeDocItem
      ? (t[activeDocItem.key] ?? activeDocItem.label)
      : (t[titleKey] ?? t.homeTitle);

  useSeo({
    path,
    locale: language,
    title: resolvedPageKey ? `${title} · SendFlow` : 'Page introuvable · SendFlow',
    description: resolvedPageKey ? description : 'La page de documentation demandée est introuvable.',
    robots: resolvedPageKey ? 'index,follow' : 'noindex,nofollow',
  });

  if (!resolvedPageKey) return <ServerNotFoundNavigation />;

  const sidebarGroups = docGroups.map((group) => ({
    key: group.labelKey,
    items: filteredItems.filter((item) => item.group === group.id),
  }));

  const renderHome = () => (
    <>
      <div className="sf-docs-eyebrow">SENDFLOW / API</div>
      <h1 className="sf-docs-title">{t.homeTitle}</h1>
      <p className="sf-docs-lede">{t.homeSub}</p>
      <CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />
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
    <div className="sf-docs-callout" role="note"><strong>{t.apiAvailabilityTitle}.</strong> {t.apiAvailabilityText}</div>
      <section className="sf-docs-section">
        <h2>{t.capabilitiesTitle}</h2>
        <ul className="sf-docs-list">
          <li>{t.capabilitySession}</li>
          <li>{t.capabilityCheckout}</li>
          <li>{t.capabilityStatus}</li>
          <li>{t.capabilityWebhook}</li>
        </ul>
        <div className="sf-docs-production-urls sf-docs-production-url-section">
          <strong>{t.baseUrlTitle}</strong>
          <span>{t.baseUrlPending}</span>
          <CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />
          <CopyableUrlBlock language={language} label={t.checkoutOriginLabel} value={productionUrls.checkoutOrigin} />
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
    const showReferenceSection = (section: string) => !activeDocSection || activeDocSection === section;
    const renderApiReference = () => (
      <section className="sf-docs-section">
        <h2>{t.reference}</h2>
        <p>{t.referenceIntro}</p>
        <div className="sf-docs-callout">{t.globalHttpErrors}</div>
        {apiEndpointGroups.map((group) => {
          const endpoints = apiEndpointInventory.filter((endpoint) => group.anchors.includes(endpoint.anchor));
          return (
            <section className="sf-docs-endpoint-group" key={group.key}>
              <h3>{t[group.key]}</h3>
              <div className="sf-docs-endpoints">
                {endpoints.map((endpoint) => (
                  <article id={endpoint.anchor} className="sf-docs-endpoint" key={endpoint.path} data-testid={`endpoint-card-${endpoint.method.toLowerCase()}-${endpoint.path.split('/').at(-1)}`}>
                    <div className="sf-docs-endpoint-head">
                      <span className={`sf-docs-method-badge is-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                      <code>{endpoint.path}</code>
                      <span className="sf-docs-endpoint-pending">{t.endpointStatus}</span>
                    </div>
                    <p>{t[endpoint.description]}</p>
                    <div className="sf-docs-endpoint-access"><span>{t.endpointAccess}</span><strong>{t[endpoint.access]}</strong></div>
                    <p className="sf-docs-endpoint-requirements">{language === 'fr' ? endpoint.requirementsFr : endpoint.requirementsEn}</p>
                    <h3>{t.parametersTitle}</h3>
                    <table className="sf-docs-reference-table">
                      <thead><tr><th>{t.parameterFieldHeader}</th><th>{t.parameterTypeHeader}</th><th>{t.parameterRequirementHeader}</th><th>{t.parameterDescriptionHeader}</th></tr></thead>
                      <tbody>{(language === 'fr' ? endpoint.fieldsFr : endpoint.fieldsEn).map((field) => (
                        <tr key={field.field}>
                          <td data-label={t.parameterFieldHeader}><code className="sf-docs-inline-code">{field.field}</code></td>
                          <td data-label={t.parameterTypeHeader}>{field.type}</td>
                          <td data-label={t.parameterRequirementHeader}>{field.requirement}</td>
                          <td data-label={t.parameterDescriptionHeader}>{field.description}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    <p className="sf-docs-endpoint-codes">{language === 'fr' ? endpoint.codesFr : endpoint.codesEn}</p>
                    <p className="sf-docs-endpoint-requirements"><strong>{language === 'fr' ? 'Erreurs et cas métier : ' : 'Errors and business cases: '}</strong>{language === 'fr' ? endpoint.errorsFr : endpoint.errorsEn}</p>
                    <details className="sf-docs-endpoint-example">
                      <summary>{t.requestExample}</summary>
                      <CodePanel language={language} label={`${endpoint.method} ${endpoint.path}`} example={endpoint.example} />
                    </details>
                    <details className="sf-docs-endpoint-example">
                      <summary>{t.responseExample}</summary>
                      <ResponsePanel
                        language={language}
                        label={`${t.responseExample} · JSON`}
                        response={endpoint.response}
                      />
                    </details>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
        <p className="sf-docs-endpoint-note">{t.availableChoicesNote}</p>
        <section className="sf-docs-section sf-docs-section--nested">
          <h2>{t.payoutApiTitle}</h2>
          <p>{t.payoutApiText}</p>
          <div className="sf-docs-callout">{t.serverOnly}</div>
          <h3>{t.payoutQuoteTitle}</h3>
          <p>{t.payoutQuoteText}</p>
          <CodePanel language={language} label="POST /api/v1/payout-quote" example="payout-quote" />

          <h3>{t.payoutCreateTitle}</h3>
          <p>{t.payoutCreateText}</p>
          <CodePanel language={language} label="POST /api/v1/payouts" example="payout-create" />

          <h3>{t.payoutListTitle}</h3>
          <p>{t.payoutListText}</p>
          <CodePanel language={language} label="GET /api/v1/payouts" example="payout-list" />

          <h3>{t.payoutReadTitle}</h3>
          <p>{t.payoutReadText}</p>
          <CodePanel language={language} label="GET /api/v1/payouts/{payoutId}" example="payout-read" />

          <h3>{t.payoutCancelTitle}</h3>
          <p>{t.payoutCancelText}</p>
          <CodePanel language={language} label="POST /api/v1/payouts/{payoutId}/cancel" example="payout-cancel" />
        </section>
        <div className="sf-docs-callout"><strong>{t.apiScopeTitle}.</strong> {t.apiScopeText}</div>
      </section>
    );
    return (
      <>
        <div className="sf-docs-breadcrumb"><Link href="/docs" onClick={() => setSelectedDocSection(null)}>{t.breadcrumb}</Link><ChevronRight size={12} /><span>{activeDocItem ? (t[activeDocItem.key] ?? activeDocItem.label) : (t[pageKey] ?? t.home)}</span></div>
        <div className="sf-docs-eyebrow">SENDFLOW / API</div>
        <h1 className="sf-docs-title">{title}</h1>
        <p className="sf-docs-lede">{description}</p>
        <div className="sf-docs-meta"><span className="sf-docs-status"><i className="sf-docs-status-dot" />{t.endpointStatus}</span></div>
        {pageKey === 'start' && <>
          <section className="sf-docs-section">
            <h2>{t.whatIs}</h2>
            <p>{t.whatIsText}</p>
          </section>
          <section className="sf-docs-section">
            <h2>{t.methods}</h2>
            <p>{t.methodsSub}</p>
            <div className="sf-docs-cards">
              <Link href="/docs/integrations/hosted" className="sf-docs-card sf-docs-card-link">
                <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Globe2 size={19} /></span><ArrowRight className="sf-docs-card-arrow" size={16} /></div>
                <h3>Hosted Checkout</h3>
                <p>{t.hostedCardSub}</p>
                <span className="sf-docs-card-cta">{t.hostedGuide}<ArrowRight size={13} /></span>
              </Link>
              <Link href="/docs/integrations/direct" className="sf-docs-card sf-docs-card-link">
                <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Code2 size={19} /></span><ArrowRight className="sf-docs-card-arrow" size={16} /></div>
                <h3>{t.directCard}</h3>
                <p>{t.directCardSub}</p>
                <span className="sf-docs-card-cta">{t.directGuide}<ArrowRight size={13} /></span>
              </Link>
            </div>
          </section>
          <section className="sf-docs-section">
            <h2>{t.capabilitiesTitle}</h2>
            <ul className="sf-docs-list">
              <li>{t.capabilitySession}</li>
              <li>{t.capabilityCheckout}</li>
              <li>{t.capabilityDirect}</li>
              <li>{t.capabilityStatus}</li>
              <li>{t.capabilityWebhook}</li>
            </ul>
          </section>
          <section className="sf-docs-section">
            <h2>{t.baseUrlTitle}</h2>
            <div className="sf-docs-production-urls sf-docs-production-url-section">
              <span>{t.baseUrlPending}</span>
              <CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />
              <CopyableUrlBlock language={language} label={t.checkoutOriginLabel} value={productionUrls.checkoutOrigin} />
            </div>
          </section>
          <section className="sf-docs-section">
            <h2>{t.threeSteps}</h2>
            <div className="sf-docs-steps">
              {localizedLists[language].stepTitles.map((heading, index) => (
                <div className="sf-docs-step" key={heading}>
                  <span className="sf-docs-step-index">0{index + 1}</span>
                  <div><strong>{heading}</strong><p>{localizedLists[language].stepTexts[index]}</p></div>
                </div>
              ))}
            </div>
          </section>
          <section className="sf-docs-section">
            <h2>{t.quickstartTitle}</h2>
            <h3>{t.quickstartPrereqTitle}</h3>
            <p>{t.quickstartPrereqText}</p>
            <div className="sf-docs-callout">{t.serverOnly}</div>
            <div className="sf-docs-callout">{t.quickstartIntegrationNote}</div>
             <div className="sf-docs-callout" role="note"><strong>{t.apiAvailabilityTitle}.</strong> {t.apiAvailabilityText}</div>

            <h3>{t.quickstartCatalogTitle}</h3>
            <p>{t.quickstartCatalogText}</p>
            <CodePanel language={language} label="GET /api/pricing" example="pricing" />

            <h3>{t.quickstartLimitsTitle}</h3>
            <p>{t.quickstartLimitsText}</p>
            <CodePanel language={language} label="GET /api/payment-limits" example="payment-limits" />

            <h3>{t.quickstartDirectTitle}</h3>
            <p>{t.quickstartDirectText}</p>
            <CodePanel language={language} label="POST /api/v1/payment-sessions" example="create-direct" />
            <ResponsePanel language={language} label={t.responseExample} response={directSessionResponse} />

            <h3>{t.quickstartChoicesTitle}</h3>
            <p>{t.quickstartChoicesText}</p>
            <CodePanel language={language} label="GET /api/v1/public/payment-sessions/{sessionId}" example="read-public-session" />

            <h3>{t.quickstartAttemptTitle}</h3>
            <p>{t.quickstartAttemptText}</p>
            <CodePanel language={language} label="POST /api/v1/public/payment-sessions/{sessionId}/attempts" example="start-attempt" />

            <h3>{t.quickstartStatusTitle}</h3>
            <p>{t.quickstartStatusText}</p>
            <CodePanel language={language} label="GET /api/v1/payment-sessions/{sessionId}" example="read-session" />
          </section>
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
          <CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />
          <div className="sf-docs-callout" role="note"><strong>{t.apiAvailabilityTitle}.</strong> {t.apiAvailabilityText}</div>
          <section className="sf-docs-section">
            <h2>{t.directPrerequisitesTitle}</h2>
            <p>{t.directPrerequisitesText}</p>
            <h3>{t.directCredentialsTitle}</h3>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.credentialHeader}</th><th>{t.credentialUseHeader}</th><th>{t.credentialHandlingHeader}</th></tr></thead>
              <tbody>{localizedLists[language].credentialRows.map((row) => (
                <tr key={row.credential}>
                  <td data-label={t.credentialHeader}>{row.credential}</td>
                  <td data-label={t.credentialUseHeader}>{row.usedFor}</td>
                  <td data-label={t.credentialHandlingHeader}>{row.handling}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="sf-docs-callout">{t.serverOnly}</div>
          </section>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{t.modelTextDirect}</p>
            <div className="sf-docs-callout">{t.directSessionReturnNote}</div>
            <h3>{t.directFlow}</h3>
            <div className="sf-docs-steps">
              {localizedLists[language].directFlowTitles.map((heading, index) => <div className="sf-docs-step" key={heading}><span className="sf-docs-step-index">0{index + 1}</span><div><strong>{heading}</strong><p>{localizedLists[language].directFlowTexts[index]}</p></div></div>)}
            </div>
            <h3>{t.directExamplesTitle}</h3>
            <div className="sf-docs-code-steps">
              <section className="sf-docs-code-step">
                <h4>{t.directStepCatalog}</h4>
                <p>{t.directCatalogText}</p>
                <CodePanel language={language} label="GET /api/pricing" example="pricing" />
                <CodePanel language={language} label="GET /api/payment-limits" example="payment-limits" />
              </section>
              <section className="sf-docs-code-step">
                <h4>{t.directStepCreate}</h4>
                <CodePanel language={language} label={t.codeLabel} example="create-direct" />
                <ResponsePanel language={language} label={t.responseExample} response={directSessionResponse} />
              </section>
              <section className="sf-docs-code-step">
                <h4>{t.directStepRead}</h4>
                <div className="sf-docs-callout">{t.directCorsNote}</div>
                <CodePanel language={language} label={t.codeLabel} example="read-public-session" />
              </section>
              <section className="sf-docs-code-step">
                <h4>{t.directStepAttempt}</h4>
                <div className="sf-docs-callout">{t.androidDirectNote}</div>
                <div className="sf-docs-callout">{t.directInputText}</div>
                <CodePanel language={language} label={t.codeLabel} example="start-attempt" />
                <ResponsePanel language={language} label={t.responseExample} response={directAttemptResponse} />
                <div className="sf-docs-callout"><strong>{t.mobileMoneyTitle}.</strong> {t.mobileMoneyText}</div>
              </section>
              <section className="sf-docs-code-step">
                <h4>{t.directStepPoll}</h4>
                <div className="sf-docs-callout">{t.pollTokenNote}</div>
                <CodePanel language={language} label={t.codeLabel} example="poll-attempt" />
                <p>{t.quickstartStatusText}</p>
                <CodePanel language={language} label="GET /api/v1/payment-sessions/{sessionId}" example="read-session" />
              </section>
            </div>
            <h3 id="direct-otp-guide">{t.mobileMoneyOtpTitle}</h3>
            <p>{t.mobileMoneyOtpText}</p>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.mobileMoneyFlowHeader}</th><th>{t.mobileMoneyResponseHeader}</th><th>{t.mobileMoneyActionHeader}</th></tr></thead>
              <tbody>{localizedLists[language].mobileMoneyOtpRows.map((row) => (
                <tr key={row.flow}>
                  <td data-label={t.mobileMoneyFlowHeader}>{row.flow}</td>
                  <td data-label={t.mobileMoneyResponseHeader}>{row.response}</td>
                  <td data-label={t.mobileMoneyActionHeader}>{row.action}</td>
                </tr>
              ))}</tbody>
            </table>
            <section className="sf-docs-code-step">
              <h4>Catalogue OTP — GET /api/pricing</h4>
              <CodePanel language={language} label="GET /api/pricing · requiresOtp / otpCommand" example="pricing" />
              <h4>{t.mobileMoneyOtpExampleTitle}</h4>
              <CodePanel language={language} label={t.codeLabel} example="start-attempt" />
              <h4>{language === 'fr' ? 'Envoyer un OTP déjà obtenu' : 'Submit an OTP obtained beforehand'}</h4>
              <ResponsePanel language={language} label="400 · otp_required" response={directOtpRequiredResponse} />
              <CodePanel language={language} label={t.codeLabel} example="submit-otp" />
              <div className="sf-docs-callout">{t.mobileMoneyOtpExampleNote}</div>
              <h4>{language === 'fr' ? 'Réponse d’un défi OTP démarré par l’opérateur' : 'Response to an operator-started OTP challenge'}</h4>
              <ResponsePanel language={language} label="201 · flow.action = enter_otp" response={directOtpChallengeResponse} />
              <h4>{language === 'fr' ? 'Confirmer le défi avec le code reçu' : 'Confirm the challenge with the received code'}</h4>
              <CodePanel language={language} label={t.codeLabel} example="confirm-otp" />
            </section>
            <h3>{t.mobileMoneyFlowsTitle}</h3>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.mobileMoneyFlowHeader}</th><th>{t.mobileMoneyResponseHeader}</th><th>{t.mobileMoneyActionHeader}</th></tr></thead>
              <tbody>{localizedLists[language].mobileMoneyFlowRows.map((row) => (
                <tr key={row.flow}>
                  <td data-label={t.mobileMoneyFlowHeader}>{row.flow}</td>
                  <td data-label={t.mobileMoneyResponseHeader}>{row.response}</td>
                  <td data-label={t.mobileMoneyActionHeader}>{row.action}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="sf-docs-callout"><strong>{t.mobileMoneyWaveTitle}.</strong> {t.mobileMoneyWaveText}</div>
            <CodePanel language={language} label={language === 'fr' ? 'Traiter une redirection renvoyée' : 'Handle a returned redirect'} example="handle-flow-action" />
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
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.mobileMoneyCountryHeader}</th><th>{t.mobileMoneyStatusHeader}</th><th>{t.mobileMoneyCodeHeader}</th><th>{t.mobileMoneyDetailsHeader}</th></tr></thead>
              <tbody>{localizedLists[language].mobileMoneyCards.map((card) => (
                <tr key={card.title}>
                  <td data-label={t.mobileMoneyCountryHeader}>
                    <strong>{card.flag && <span aria-hidden="true">{card.flag} </span>}{card.title}</strong>
                    {card.countryCode && <> <code className="sf-docs-inline-code">{`country_code: "${card.countryCode}"`}</code></>}
                  </td>
                  <td data-label={t.mobileMoneyStatusHeader}>{card.status}</td>
                  <td data-label={t.mobileMoneyCodeHeader}><code>{card.code}</code></td>
                  <td data-label={t.mobileMoneyDetailsHeader}>{card.body}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
          {renderApiReference()}
          <section className="sf-docs-section">
            <h2>{t.directWebhookSetupTitle}</h2>
            <p>{t.directWebhookSetupText}</p>
            <h3>{t.webhookEvents}</h3>
            <p>{t.webhookEventsSub}</p>
            <p>{t.directWebhookDeliveryText}</p>
            <p>{t.deliveryText}</p>
            <p>{t.webhookPayloadNote}</p>
            <div className="sf-docs-callout">
              <strong>{t.webhookHeadersTitle}</strong>
              <p>{t.webhookHeadersText}</p>
              <pre className="sf-docs-response"><code>{`sendflow-event: payment.succeeded
sendflow-delivery: 9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644
sendflow-signature: t=<unix-timestamp>,v1=<hex-signature>`}</code></pre>
            </div>
            <ResponsePanel language={language} label={`${t.responseExample} · payment.succeeded`} response={`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644",
  "type": "payment.succeeded",
  "createdAt": "2026-10-29T10:31:00.000Z",
  "data": {
    "sessionId": "00000000-0000-4000-8000-000000000001",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "00000000-0000-4000-8000-000000000002",
    "transactionId": "00000000-0000-4000-8000-000000000003",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "succeeded"
  }
}`} />
            <CodePanel language={language} label={t.codeLabel} example="webhook" />
            <div className="sf-docs-callout"><strong>{t.webhookSharedNote}</strong> <Link href="/docs/webhooks">{t.webhookGuideLink}</Link></div>
          </section>
          <section className="sf-docs-section">
            <h2>{t.directReliabilityTitle}</h2>
            <p>{t.idempotencyText}</p>
            <p>{t.expirationText}</p>
            <p>{t.directReliabilityText}</p>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.errorStatusHeader}</th><th>{t.errorMeaningHeader}</th><th>{t.errorActionHeader}</th></tr></thead>
              <tbody>{localizedLists[language].httpErrorRows.map((row) => (
                <tr key={row.status}>
                  <td data-label={t.errorStatusHeader}><code className="sf-docs-inline-code">{row.status}</code></td>
                  <td data-label={t.errorMeaningHeader}>{row.meaning}</td>
                  <td data-label={t.errorActionHeader}>{row.action}</td>
                </tr>
              ))}</tbody>
            </table>
            <CodePanel language={language} label={t.codeLabel} example="handle-http-errors" />
          </section>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
        </>}
        {pageKey === 'hosted' && <>
          <div className="sf-docs-production-urls">
            <CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />
            <CopyableUrlBlock language={language} label={t.checkoutOriginLabel} value={productionUrls.checkoutOrigin} />
          </div>
          <div className="sf-docs-callout" role="note"><strong>{t.apiAvailabilityTitle}.</strong> {t.apiAvailabilityText}</div>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{t.modelTextHosted}</p>
            <h3>{t.hostedFlow}</h3>
            <div className="sf-docs-steps">
              {localizedLists[language].hostedFlowTitles.map((heading, index) => <div className="sf-docs-step" key={heading}><span className="sf-docs-step-index">0{index + 1}</span><div><strong>{heading}</strong><p>{localizedLists[language].hostedFlowTexts[index]}</p></div></div>)}
            </div>
            <h3>{t.hostedExamplesTitle}</h3>
            <div className="sf-docs-code-steps">
              <section className="sf-docs-code-step">
                <h4>{t.hostedStepCreate}</h4>
                <CodePanel language={language} label={t.codeLabel} example="create-hosted" />
                <ResponsePanel language={language} label={t.responseExample} response={hostedSessionResponse} />
              </section>
              <section className="sf-docs-code-step">
                <h4>{t.hostedStepStatus}</h4>
                <CodePanel language={language} label={t.codeLabel} example="read-session" />
              </section>
            </div>
            <div className="sf-docs-callout">
              <p>{t.hostedOriginText}</p>
              <p><strong>{t.returnUrlTitle}</strong></p>
              <p>{t.returnUrlText}</p>
              <p>{t.hostedFallbackText}</p>
              <p>{t.hostedTimerText}</p>
            </div>
          </section>
          <div className="sf-docs-callout"><strong>{t.webhookSharedNote}</strong> <Link href="/docs/webhooks">{t.webhookGuideLink}</Link></div>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <div className="sf-docs-warning" role="note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>{t.disclaimerTitle}</strong>{t.disclaimer}</div></div>
        </>}
        {pageKey === 'webhooks' && <>
          {showReferenceSection('webhook-events') && <section className="sf-docs-section"><h2>{t.webhookEvents}</h2><p>{t.webhookEventsSub}</p>
            <div className="sf-docs-card" style={{ marginTop: 15 }}>
              <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Webhook size={18} /></span><span className="sf-docs-status">{t.endpointStatus}</span></div>
              <h3>{t.eventNames}</h3>
              <ul className="sf-docs-list">
                {['payment.succeeded', 'payment.failed', 'payout.created', 'payout.processing', 'payout.succeeded', 'payout.failed', 'payout.uncertain'].map((event) => (
                  <li key={event}><code className="sf-docs-inline-code">{event}</code></li>
                ))}
              </ul>
            </div>
            <ResponsePanel language={language} label={`${t.responseExample} · payment.succeeded`} response={`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28644",
  "type": "payment.succeeded",
  "createdAt": "2026-10-29T10:31:00.000Z",
  "data": {
    "sessionId": "00000000-0000-4000-8000-000000000001",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "00000000-0000-4000-8000-000000000002",
    "transactionId": "00000000-0000-4000-8000-000000000003",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "succeeded"
  }
}`} />
            <ResponsePanel language={language} label={`${t.responseExample} · payment.failed`} response={`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28645",
  "type": "payment.failed",
  "createdAt": "2026-10-29T10:32:00.000Z",
  "data": {
    "sessionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
    "merchantReference": "ORDER-2026-0042",
    "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
    "transactionId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28643",
    "amountMinor": 12500,
    "currency": "XOF",
    "status": "failed"
  }
}`} />
            <ResponsePanel language={language} label={`${t.responseExample} · payout.created`} response={`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28646",
  "type": "payout.created",
  "createdAt": "2026-10-29T10:33:00.000Z",
  "data": {
    "amountMinor": 12500,
    "beneficiaryAmountMinor": 12500,
    "countryCode": "ci",
    "currency": "XOF",
    "feeMinor": 250,
    "feePayer": "merchant",
    "merchantReference": "ORDER-PAYOUT-2026-001",
    "operatorId": "operator-id-from-sendflow",
    "payoutId": "00000000-0000-4000-8000-000000000004",
    "reference": "SFPOA1B2C3D4E5F60718",
    "status": "funds_reserved",
    "totalDebitMinor": 12750
  }
}`} />
          </section>}
          {showReferenceSection('webhook-signature') || activeDocSection === 'webhook-retries' ? <section className="sf-docs-section"><h2>{t.delivery}</h2>
            <p>{t.deliveryText}</p>
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
          </section> : null}
        </>}
        {pageKey === 'ref' && <>
          {showReferenceSection('payment-states') && <section className="sf-docs-section"><h2>{t.statesTitle}</h2><p>{t.statesText}</p>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{language === 'fr' ? 'État' : 'State'}</th><th>{language === 'fr' ? 'Signification' : 'Meaning'}</th><th>{language === 'fr' ? 'Action marchande' : 'Merchant action'}</th></tr></thead>
              <tbody>{localizedLists[language].paymentStateRows.map((row) => <tr key={row.state}><td data-label={language === 'fr' ? 'État' : 'State'}><code className="sf-docs-inline-code">{row.state}</code></td><td data-label={language === 'fr' ? 'Signification' : 'Meaning'}>{row.meaning}</td><td data-label={language === 'fr' ? 'Action marchande' : 'Merchant action'}>{row.action}</td></tr>)}</tbody>
            </table>
            <CodePanel language={language} label={language === 'fr' ? 'Lire le statut de session' : 'Read session status'} example="read-session" />
            <CodePanel language={language} label={language === 'fr' ? 'Lire le statut d’une tentative directe' : 'Read direct attempt status'} example="poll-attempt" />
            <ResponsePanel language={language} label={language === 'fr' ? 'Réponse de tentative · failed' : 'Attempt response · failed'} response={`{
  "id": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28641",
  "attemptId": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642",
  "state": "failed",
  "amountMinor": 12500,
  "currency": "XOF",
  "ussdCode": null,
  "pollToken": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merchantReference": "ORDER-2026-0043"
}`} />
          </section>}
          {showReferenceSection('idempotency') && <section className="sf-docs-section"><h2>{t.idempotency}</h2><p>{t.idempotencyText}</p><CodePanel language={language} label={t.codeLabel} example="create-hosted" /></section>}
          {showReferenceSection('expiration') && <section className="sf-docs-section"><h2>{t.expiration}</h2><p>{t.expirationText}</p><CodePanel language={language} label={t.codeLabel} example="read-session" /></section>}
          {showReferenceSection('rate-limits') && <section className="sf-docs-section"><h2>{t.rateLimits}</h2><p>{t.rateLimitsText}</p></section>}
          {showReferenceSection('service-availability') && <section className="sf-docs-section">
            <h2>{t.serviceAvailability}</h2>
            <div className="sf-docs-callout">{t.environmentNote}</div>
            <div className="sf-docs-production-urls">
              <CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />
              <CopyableUrlBlock language={language} label={t.checkoutOriginLabel} value={productionUrls.checkoutOrigin} />
              <CopyableUrlBlock language={language} label={t.merchantAppLabel} value={productionUrls.merchantApp} />
              <CopyableUrlBlock language={language} label={t.publicSiteLabel} value={productionUrls.publicSite} />
              <CopyableUrlBlock language={language} label={t.documentationUrlLabel} value={productionUrls.documentation} />
            </div>
            <p>{t.serviceAvailabilityText}</p>
          </section>}
          {showReferenceSection('http-errors') && <section className="sf-docs-section"><h2>{t.errors}</h2><p>{t.errorsText}</p><div className="sf-docs-callout">{t.globalHttpErrors}</div>
            <h3>{t.httpErrorTableTitle}</h3>
            <table className="sf-docs-reference-table">
              <thead><tr><th>{t.errorStatusHeader}</th><th>{t.errorMeaningHeader}</th><th>{t.errorActionHeader}</th></tr></thead>
              <tbody>{localizedLists[language].httpErrorRows.map((row) => <tr key={row.status}><td data-label={t.errorStatusHeader}><code className="sf-docs-inline-code">{row.status}</code></td><td data-label={t.errorMeaningHeader}>{row.meaning}</td><td data-label={t.errorActionHeader}>{row.action}</td></tr>)}</tbody>
            </table>
            <ResponsePanel language={language} label={t.errorEnvelopeTitle} response={`{
  "error": "${language === 'fr' ? 'Message d’erreur renvoyé par l’API' : 'Error message returned by the API'}"
}`} />
            <CodePanel language={language} label={t.codeLabel} example="handle-http-errors" />
          </section>}
          {showReferenceSection('http-errors') && <section className="sf-docs-section"><h2>{t.troubleshootingTitle}</h2>
            <div className="sf-docs-endpoints">
              {localizedLists[language].troubleshooting.map((item) => (
                <article className="sf-docs-endpoint sf-docs-info" key={item.symptom}>
                  <div className="sf-docs-endpoint-head"><strong>{item.symptom}</strong></div>
                  <p>{item.action}</p>
                </article>
              ))}
            </div>
          </section>}
          {showReferenceSection('security') && <section className="sf-docs-section"><h2>{t.security}</h2><p>{t.securityText}</p></section>}
        </>}
      </>
    );
  };

  return (
    <div className="sf-docs">
      <header className="sf-docs-header">
        <button type="button" className="sf-docs-mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-expanded={sidebarOpen} aria-label={sidebarOpen ? t.menuClose : t.contents} data-testid="button-docs-mobile-nav">{sidebarOpen ? <X size={18} /> : <Menu size={18} />}</button>
          <Link href="/docs" className="sf-docs-brand" onClick={() => setSelectedDocSection(null)} aria-label="SendFlow documentation" data-testid="link-docs-home">
          <span className="sf-docs-brand-mark"><img src={sendflowMark} alt="" /></span><img className="sf-docs-brand-word" src={sendflowWordmark} alt="SendFlow" />
        </Link>
        <nav className="sf-docs-nav" aria-label="Main navigation">
          <Link href="/docs" className={path === '/docs' ? 'is-active' : ''} onClick={() => setSelectedDocSection(null)} data-testid="link-docs-top-home">{t.navDocs}</Link>
          <Link href="/docs/getting-started" className={path === '/docs/getting-started' ? 'is-active' : ''} onClick={() => setSelectedDocSection(null)} data-testid="link-docs-top-guides">{t.navGuides}</Link>
          <Link href="/docs/integrations/direct" className={path === '/docs/integrations/direct' ? 'is-active' : ''} onClick={() => setSelectedDocSection(null)} data-testid="link-docs-top-api">{t.navApi}</Link>
          <Link href="/docs/webhooks" className={path === '/docs/webhooks' ? 'is-active' : ''} onClick={() => setSelectedDocSection(null)} data-testid="link-docs-top-webhooks">{t.navWebhooks}</Link>
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
          <span>{t[activeDocGroup?.labelKey ?? 'startGroup']}</span><ChevronRight size={15} aria-hidden="true" />
         <span className="sf-docs-mobile-crumb-current">{activeDocItem ? (t[activeDocItem.key] ?? activeDocItem.label) : (t[pageKey] ?? t.home)}</span>
      </div>
      <div className="sf-docs-shell">
        {sidebarOpen && <button type="button" className="sf-docs-mobile-backdrop" aria-label="Close documentation menu" onClick={() => setSidebarOpen(false)} data-testid="button-close-docs-sidebar" />}
        <aside className={`sf-docs-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label={language === 'fr' ? 'Navigation de la documentation' : 'Documentation navigation'}>
          <div className="sf-docs-drawer-head">
            <button type="button" className="sf-docs-drawer-close" onClick={() => setSidebarOpen(false)} aria-label={t.menuClose} data-testid="button-close-docs-drawer"><X size={18} /></button>
            <Link href="/docs" className="sf-docs-drawer-brand" onClick={() => { setSidebarOpen(false); setSelectedDocSection(null); }} aria-label="SendFlow documentation" data-testid="link-docs-drawer-brand">
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
                    const isActive = isDocItemActive(item);
                    return <Link href={item.section ? `${item.path}#${item.section}` : item.path} key={`${item.path}:${item.section ?? 'page'}`} onClick={() => handleDocItemClick(item)} className={`sf-docs-side-link${isActive ? ' is-active' : ''}`} aria-current={isActive ? 'page' : undefined} data-testid={`link-docs-${item.key}-${item.section ?? 'page'}`}><Icon size={13} />{t[item.key] ?? item.label}</Link>;
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
