import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertTriangle, ArrowRight, BookOpen, Check, ChevronRight,
  Code2, Copy, FileCode2, Globe2, LifeBuoy, LockKeyhole, Menu, Search, ShieldCheck,
  Webhook, X,
} from 'lucide-react';
import sendflowMark from '@assets/sendflow-mark-original.png';
import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import apiIntegrationIllustration from '../assets/docs-api-integration-3d.webp';
import hostedCheckoutIllustration from '../assets/docs-hosted-checkout-3d.webp';
import { useSeo } from '@/lib/seo';
import './docs.css';

type Language = 'fr' | 'en';
type DocGroup = 'start' | 'checkout' | 'integration' | 'directApi' | 'reference';
type DocItem = { path: string; key: string; label: string; group: DocGroup; icon: typeof BookOpen };
type Translation = Record<string, string>;
type TranslationLists = {
  stepTitles: string[];
  stepTexts: string[];
  responsibilitiesText: string[];
  tableRows: string[][];
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
    dashboard: 'Espace développeur', search: 'Rechercher dans la documentation…', menuClose: 'Fermer le menu', startGroup: 'Démarrer',
    checkoutGroup: 'Checkout', integrations: 'Intégration', directApi: 'API directe',
    reference: 'Référence', resources: 'Ressources', noResults: 'Aucun document ne correspond à cette recherche.',
    home: 'Documentation', start: 'Bien démarrer', auth: 'Authentification', direct: 'Intégration directe',
    hosted: 'Redirection hébergée', api: 'Référence API', webhooks: 'Webhooks', ref: 'Erreurs et sécurité',
    badge: 'Contrat à valider', prod: 'Disponibilité production non vérifiée',
    homeTitle: 'Intégrez SendFlow à votre plateforme',
    homeSub: 'Découvrez les outils et les API nécessaires pour accepter les paiements avec SendFlow.',
    startTitle: 'Préparer votre intégration', startSub: 'Un parcours de mise en place clair, avec les points à confirmer avant toute implémentation réelle.',
    authTitle: 'Authentification', authSub: 'Les modalités d’authentification de l’API doivent être confirmées à partir du contrat serveur avant d’envoyer une requête.',
    directTitle: 'Intégration directe', directSub: 'Préparez un parcours de paiement piloté depuis votre serveur. Les détails du contrat et les opérations disponibles restent à valider.',
    hostedTitle: 'Redirection hébergée', hostedSub: 'Découvrez le modèle de parcours avec redirection, sans supposer d’URL, de paramètres ou de comportement non confirmés.',
    apiTitle: 'Référence API', apiSub: 'Référence descriptive. Les routes, champs et réponses publiables doivent être confirmés avec le contrat actif.',
    webhooksTitle: 'Webhooks', webhooksSub: 'Préparez la réception d’événements de paiement. Les formats d’événements, mécanismes de signature et règles de reprise ne sont pas encore validés.',
    refTitle: 'Erreurs, idempotence et sécurité', refSub: 'Principes à définir avant mise en production. Aucun comportement de protocole n’est présumé dans cette page.',
    breadcrumb: 'Documentation développeur', methods: 'Choisissez votre approche', methodsSub: 'Les deux options décrivent des modèles d’intégration. Les détails techniques doivent être validés avant leur utilisation.',
    directCard: 'API directe', directCardSub: 'Votre serveur contrôle le parcours et orchestre l’expérience dans votre application.',
    hostedCard: 'Paiement hébergé', hostedCardSub: 'Votre application oriente le client vers un parcours hébergé, sous réserve de disponibilité.',
    heroStart: 'Commencer l’intégration', heroApi: 'Explorer l’API',
    methodLevel: 'Niveau', methodControl: 'Contrôle du parcours', methodIntegration: 'Intégration', methodAuth: 'Authentification', methodReturn: 'Retour du paiement',
    developerLevel: 'Développeur', simpleLevel: 'Simple', highControl: 'Élevé', hostedControl: 'Limité à la page hébergée',
    restApi: 'API REST', sessionRedirect: 'Création de session puis redirection',
    authContract: 'Clé API selon le contrat à confirmer', returnToConfirm: 'À confirmer selon le contrat',
    directGuide: 'Voir le guide API directe', hostedGuide: 'Voir le guide de redirection',
    capabilitiesTitle: 'Ce que l’intégration SendFlow prévoit',
    capabilitySession: 'Créer une session de paiement depuis votre serveur marchand.',
    capabilityCheckout: 'Présenter un parcours hébergé SendFlow au payeur.',
    capabilityStatus: 'Consulter le statut d’une session et d’une tentative.',
    capabilityWebhook: 'Recevoir les notifications de paiement réussi ou échoué par webhook.',
    baseUrlTitle: 'URL de base API',
    baseUrlPending: 'À confirmer avant intégration. Ne vous basez pas sur l’adresse de cette documentation.',
    threeSteps: 'Parcours recommandé', stepOne: 'Créez votre compte marchand', stepOneSub: 'Préparez votre accès à l’espace marchand SendFlow.', stepTwo: 'Configurez vos clés API', stepTwoSub: 'Consultez et protégez les clés depuis l’espace Développeurs.', stepThree: 'Intégrez SendFlow à votre application', stepThreeSub: 'Faites valider le contrat avant d’activer un parcours réel.',
    read: 'Lire le guide', support: 'Besoin d’un échange technique ?', supportSub: 'Contactez l’équipe SendFlow pour clarifier le périmètre et les éléments à confirmer avant une intégration.', contact: 'Contacter le support',
    disclaimerTitle: 'État du contrat API', disclaimer: 'Les paiements ne sont pas annoncés comme disponibles en production. L’exécution reste fermée tant que les preuves de règlement ne sont pas prêtes. Le contrat API et le flux fournisseur réel n’ont pas été validés pour la production.',
    whatIs: 'Avant de commencer', whatIsText: 'Cette documentation aide à cadrer un projet d’intégration. Elle ne remplace pas l’accès à un contrat API validé ni une confirmation de disponibilité par SendFlow.',
    prerequisites: 'À confirmer avec SendFlow', noCredentials: 'Ne placez jamais de secret ou d’identifiant sensible dans le navigateur, un dépôt public ou un journal client.',
    notDocumented: 'Non documenté à ce stade', notDocumentedText: 'Aucun nom d’hôte, identifiant, méthode d’authentification ou endpoint n’est fourni ici : ces éléments doivent être confirmés auprès de l’équipe SendFlow.',
    serverOnly: 'Gardez toute authentification côté serveur. N’exposez jamais de secret dans le navigateur, une application mobile distribuée ou un dépôt.',
    codeLabel: 'Exemple', placeholder: 'Exemple à valider', codeNote: 'Extrait volontairement limité à un commentaire : aucun appel API publiable n’a été validé dans les sources disponibles.',
    model: 'Modèle d’intégration', modelTextDirect: 'Une intégration directe implique un échange entre votre serveur et SendFlow. Les appels, champs et transitions exacts ne sont pas décrits ici tant que le contrat n’est pas confirmé.',
    modelTextHosted: 'Une redirection hébergée peut réduire la logique de paiement maintenue par votre produit. L’URL de redirection, les paramètres et le retour client ne sont pas documentés ici.',
    responsibilities: 'Points à prévoir',
    endpointStatus: 'Contrat à valider — disponibilité production non vérifiée',
    endpointCreate: 'Créer une session de paiement', endpointRead: 'Consulter une session et son état',
    endpointChoices: 'Lire les pays et opérateurs renvoyés pour la session',
    endpointAttempt: 'Créer une tentative de paiement directe', endpointAttemptRead: 'Consulter le statut d’une tentative',
    accessServerSecret: 'Serveur marchand · clé secrète et clé d’idempotence',
    accessServerSecretRead: 'Serveur marchand · clé secrète',
    accessPublicSession: 'Caisse · clé publique et jeton de session',
    accessPublicAttempt: 'Caisse · clé publique, jeton de session et clé d’idempotence',
    accessAttemptRead: 'Caisse · clé publique, jeton de session et jeton de tentative',
    endpointAccess: 'Accès prévu dans le code',
    availableChoicesNote: 'Les moyens disponibles sont renvoyés avec les informations publiques de session ; aucun endpoint marchand distinct de catalogue n’est présenté ici.',
    referenceIntro: 'Aucun endpoint, payload, code de réponse, identifiant, en-tête ou format de signature n’est reproduit sans source confirmée.',
    tableArea: 'Zone', tableStatus: 'État de validation', tableDescription: 'Ce qui reste à confirmer',
    webhookEvents: 'Événements pris en charge dans l’espace marchand', webhookEventsSub: 'L’interface développeur actuelle affiche les types d’événements suivants. Leur schéma de livraison reste à confirmer.',
    eventNames: 'Types visibles dans l’espace développeur', delivery: 'Livraison', deliveryText: 'Les règles de signature, d’accusé de réception, de délai et de nouvelle tentative ne sont pas publiées ici. Confirmez-les avant de traiter les notifications comme source d’état.',
    security: 'Sécurité et fiabilité', errors: 'Erreurs et reprises', idempotency: 'Idempotence', expiration: 'Expiration', securityText: 'Ne journalisez pas les secrets ou données sensibles. Validez les entrées côté serveur et protégez les routes de paiement selon le contrat qui sera confirmé.',
    errorsText: 'Les codes d’erreur, causes, tentatives et réponses attendues ne sont pas documentés à ce stade. Votre application doit distinguer une erreur technique d’un état métier uniquement selon des réponses validées.',
    idempotencyText: 'Aucune clé ni règle d’idempotence n’est confirmée. Ne réessayez pas une opération susceptible de créer un doublon avant que le comportement officiel soit spécifié.',
    expirationText: 'Les durées de session ou de lien, ainsi que le comportement à expiration, doivent être spécifiés pour chaque parcours avant mise en œuvre.',
    language: 'Langue', copyright: 'SendFlow · Documentation développeur', lastUpdated: 'Documentation de travail',
    contents: 'Sommaire',
  },
  en: {
    navDocs: 'Documentation', navGuides: 'Guides', navApi: 'API reference', navWebhooks: 'Webhooks',
    dashboard: 'Developer dashboard', search: 'Search documentation…', menuClose: 'Close menu', startGroup: 'Start here',
    checkoutGroup: 'Checkout', integrations: 'Integration', directApi: 'Direct API',
    reference: 'Reference', resources: 'Resources', noResults: 'No documents match your search.',
    home: 'Documentation', start: 'Getting started', auth: 'Authentication', direct: 'Direct integration',
    hosted: 'Hosted redirect', api: 'API reference', webhooks: 'Webhooks', ref: 'Errors & security',
    badge: 'Contract to validate', prod: 'Production availability not verified',
    homeTitle: 'Integrate SendFlow with your platform',
    homeSub: 'Discover the tools and APIs you need to accept payments with SendFlow.',
    startTitle: 'Prepare your integration', startSub: 'A clear setup path, with the details to confirm before any real implementation.',
    authTitle: 'Authentication', authSub: 'API authentication requirements must be confirmed against the server contract before sending a request.',
    directTitle: 'Direct integration', directSub: 'Prepare a payment flow controlled by your server. Contract details and available operations remain subject to validation.',
    hostedTitle: 'Hosted redirect', hostedSub: 'Explore a redirect-based flow without assuming an unconfirmed URL, parameter, or behavior.',
    apiTitle: 'API reference', apiSub: 'Descriptive reference only. Publishable routes, fields, and responses must be confirmed against the active contract.',
    webhooksTitle: 'Webhooks', webhooksSub: 'Prepare to receive payment events. Event schemas, signing mechanisms, and retry rules have not yet been validated.',
    refTitle: 'Errors, idempotency & security', refSub: 'Principles to define before production. No protocol behavior is assumed on this page.',
    breadcrumb: 'Developer documentation', methods: 'Choose your approach', methodsSub: 'These options describe integration models. Technical details must be validated before use.',
    directCard: 'Direct API', directCardSub: 'Your server controls the flow and orchestrates the experience in your application.',
    hostedCard: 'Hosted payment', hostedCardSub: 'Your application routes the customer to a hosted flow, subject to availability.',
    heroStart: 'Start integrating', heroApi: 'Explore the API',
    methodLevel: 'Level', methodControl: 'Flow control', methodIntegration: 'Integration', methodAuth: 'Authentication', methodReturn: 'Payment return',
    developerLevel: 'Developer', simpleLevel: 'Simple', highControl: 'High', hostedControl: 'Limited to hosted page',
    restApi: 'REST API', sessionRedirect: 'Create a session, then redirect',
    authContract: 'API key, subject to contract confirmation', returnToConfirm: 'To be confirmed against the contract',
    directGuide: 'View the direct API guide', hostedGuide: 'View the redirect guide',
    capabilitiesTitle: 'What SendFlow integration covers',
    capabilitySession: 'Create a payment session from your merchant server.',
    capabilityCheckout: 'Present a SendFlow-hosted payment flow to the payer.',
    capabilityStatus: 'Read the status of a session and payment attempt.',
    capabilityWebhook: 'Receive successful or failed payment notifications by webhook.',
    baseUrlTitle: 'API base URL',
    baseUrlPending: 'To be confirmed before integration. Do not use the documentation address as the API host.',
    threeSteps: 'Recommended flow', stepOne: 'Create your merchant account', stepOneSub: 'Prepare access to the SendFlow merchant dashboard.', stepTwo: 'Configure your API keys', stepTwoSub: 'View and protect your keys in the Developers area.', stepThree: 'Integrate SendFlow into your app', stepThreeSub: 'Validate the contract before enabling a real payment flow.',
    read: 'Read the guide', support: 'Need a technical conversation?', supportSub: 'Contact the SendFlow team to clarify scope and the items to confirm before integration.', contact: 'Contact support',
    disclaimerTitle: 'API contract status', disclaimer: 'Payments are not announced as production-ready. Execution remains closed until settlement proof is ready. The API contract and real provider flow have not been validated for production.',
    whatIs: 'Before you start', whatIsText: 'This documentation helps scope an integration project. It does not replace access to a validated API contract or a production availability confirmation from SendFlow.',
    prerequisites: 'Confirm with SendFlow', noCredentials: 'Never put a secret or sensitive identifier in a browser, public repository, or client-side log.',
    notDocumented: 'Not documented yet', notDocumentedText: 'No hostname, credential, authentication method, or endpoint is provided here; confirm these with the SendFlow team.',
    serverOnly: 'Keep all authentication server-side. Never expose a secret in a browser, distributed mobile app, or repository.',
    codeLabel: 'Example', placeholder: 'Example to validate', codeNote: 'Intentionally limited to a comment: no API call has been validated for publication in the available source.',
    model: 'Integration model', modelTextDirect: 'A direct integration involves an exchange between your server and SendFlow. Exact calls, fields, and transitions are not described until the contract is confirmed.',
    modelTextHosted: 'A hosted redirect may reduce payment logic maintained by your product. The redirect URL, parameters, and customer return flow are not documented here.',
    responsibilities: 'Points to plan for',
    endpointStatus: 'Contract to validate — production availability not verified',
    endpointCreate: 'Create a payment session', endpointRead: 'Read a session and its status',
    endpointChoices: 'Read countries and operators returned for the session',
    endpointAttempt: 'Create a direct payment attempt', endpointAttemptRead: 'Read an attempt status',
    accessServerSecret: 'Merchant server · secret key and idempotency key',
    accessServerSecretRead: 'Merchant server · secret key',
    accessPublicSession: 'Checkout · public key and session token',
    accessPublicAttempt: 'Checkout · public key, session token, and idempotency key',
    accessAttemptRead: 'Checkout · public key, session token, and attempt token',
    endpointAccess: 'Access shown in source code',
    availableChoicesNote: 'Available methods are returned with public session details; no separate merchant catalog endpoint is presented here.',
    referenceIntro: 'No endpoint, payload, response code, identifier, header, or signature format is reproduced without a confirmed source.',
    tableArea: 'Area', tableStatus: 'Validation status', tableDescription: 'What remains to confirm',
    webhookEvents: 'Event types shown in the merchant dashboard', webhookEventsSub: 'The current developer interface displays the following event types. Delivery schemas remain to be confirmed.',
    eventNames: 'Types visible in the developer workspace', delivery: 'Delivery', deliveryText: 'Signing, acknowledgment, timing, and retry rules are not published here. Confirm them before treating notifications as a source of state.',
    security: 'Security & reliability', errors: 'Errors and retries', idempotency: 'Idempotency', expiration: 'Expiration', securityText: 'Do not log secrets or sensitive data. Validate inputs server-side and protect payment routes according to the contract once confirmed.',
    errorsText: 'Error codes, causes, retries, and expected responses are not documented yet. Distinguish technical errors from business states only using validated responses.',
    idempotencyText: 'No idempotency key or rule is confirmed. Do not retry an operation that could create a duplicate until official behavior is specified.',
    expirationText: 'Session or link durations, and behavior on expiration, must be specified for each flow before implementation.',
    language: 'Language', copyright: 'SendFlow · Developer documentation', lastUpdated: 'Working documentation',
    contents: 'Contents',
  },
};

const localizedLists: Record<Language, TranslationLists> = {
  fr: {
    stepTitles: ['Créez votre compte marchand', 'Configurez vos clés API', 'Intégrez SendFlow à votre application'],
    stepTexts: ['Créez votre accès marchand SendFlow.', 'Gérez et protégez vos clés depuis l’espace Développeurs.', 'Faites valider le contrat API avant tout paiement réel.'],
    responsibilitiesText: ['Ne confirmez une commande qu’après une vérification fiable du statut côté serveur.', 'Prévoyez une gestion claire des paiements en attente, échoués ou interrompus.', 'N’intégrez aucune adresse ni aucun champ non confirmés par SendFlow.'],
    tableRows: [['Authentification', 'À valider', 'Méthode, format des identifiants et règles de rotation'], ['Création / statut paiement', 'À valider', 'Chemins, champs requis, réponses et transitions'], ['Webhooks', 'À valider', 'Événements, corps, signature, reprises et ordre'], ['Erreurs & idempotence', 'À valider', 'Codes, clé, durée de conservation et comportement'], ['Expiration & sécurité', 'À valider', 'Délais, protections et exigences de mise en production']],
  },
  en: {
    stepTitles: ['Create your merchant account', 'Configure your API keys', 'Integrate SendFlow into your app'],
    stepTexts: ['Create your SendFlow merchant access.', 'Manage and protect your keys in the Developers area.', 'Validate the API contract before any real payment.'],
    responsibilitiesText: ['Confirm an order only after reliably checking its status server-side.', 'Plan clear handling for pending, failed, or interrupted payments.', 'Do not integrate any address or field that SendFlow has not confirmed.'],
    tableRows: [['Authentication', 'To validate', 'Method, credential format, and rotation rules'], ['Payment create / status', 'To validate', 'Paths, required fields, responses, and transitions'], ['Webhooks', 'To validate', 'Events, body, signature, retries, and ordering'], ['Errors & idempotency', 'To validate', 'Codes, key, retention period, and behavior'], ['Expiration & security', 'To validate', 'Durations, protections, and launch requirements']],
  },
};

const pageKeys: Record<string, string> = {
  '/docs': 'home', '/docs/getting-started': 'start', '/docs/authentication': 'auth',
  '/docs/integrations/direct': 'direct', '/docs/integrations/hosted': 'hosted',
  '/docs/api-reference': 'api', '/docs/webhooks': 'webhooks', '/docs/reference': 'ref',
};

const apiEndpointInventory = [
  { method: 'POST', path: '/api/v1/payment-sessions', description: 'endpointCreate', access: 'accessServerSecret' },
  { method: 'GET', path: '/api/v1/payment-sessions/{sessionId}', description: 'endpointRead', access: 'accessServerSecretRead' },
  { method: 'GET', path: '/api/v1/public/payment-sessions/{sessionId}', description: 'endpointChoices', access: 'accessPublicSession' },
  { method: 'POST', path: '/api/v1/public/payment-sessions/{sessionId}/attempts', description: 'endpointAttempt', access: 'accessPublicAttempt' },
  { method: 'GET', path: '/api/v1/public/payment-sessions/{sessionId}/attempts/{attemptId}', description: 'endpointAttemptRead', access: 'accessAttemptRead' },
] as const;

const docSearchTerms: Record<string, string> = {
  '/docs': 'accueil home intégration paiements payment',
  '/docs/getting-started': 'prérequis compte marchand étapes getting started',
  '/docs/authentication': 'clé api publique secrète bearer authentification credentials',
  '/docs/integrations/direct': 'api directe session tentative paiement mobile money',
  '/docs/integrations/hosted': 'redirection hébergée checkout page payment link',
  '/docs/api-reference': `${apiEndpointInventory.map((endpoint) => `${endpoint.method} ${endpoint.path} ${endpoint.description}`).join(' ')} moyens de paiement opérateurs session tentative statut`,
  '/docs/webhooks': 'webhook événements notifications signature retries livraisons payment.succeeded payment.failed',
  '/docs/reference': 'erreurs idempotence expiration sécurité limites',
};

function CodePanel({ language, label }: { language: Language; label: string }) {
  const [format, setFormat] = useState('cURL');
  const [copied, setCopied] = useState(false);
  const unavailableText = language === 'fr' ? 'À valider : aucun appel API publiable.' : 'To validate: no publishable API call.';
  const copyText = ['cURL', 'Python'].includes(format) ? `# ${unavailableText}` : `// ${unavailableText}`;
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
            {['cURL', 'JavaScript', 'PHP', 'Python'].map((option) => (
              <button key={option} type="button" className={format === option ? 'is-active' : ''} onClick={() => setFormat(option)} aria-pressed={format === option} data-testid={`button-code-language-${option.toLowerCase()}`}>{option}</button>
            ))}
          </div>
          <button type="button" className="sf-docs-copy" onClick={() => void copy()} data-testid="button-copy-code">
            {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}
          </button>
        </div>
      </div>
      <pre><code><span className="sf-docs-code-comment">{copyText}</span></code></pre>
      <div className="sf-docs-code-note">{localized[language].codeNote} · {format}</div>
    </div>
  );
}

function StatusNotice({ language }: { language: Language }) {
  const t = localized[language];
  return (
    <div className="sf-docs-warning" role="note" data-testid="status-contract-validation">
      <AlertTriangle size={16} aria-hidden="true" />
      <div><strong>{t.disclaimerTitle} · {t.badge}</strong>{t.disclaimer}</div>
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
  const activeItem = docsItems.find((item) => item.path === path) ?? docsItems[0];
  const activeGroup = docGroups.find((group) => group.id === activeItem.group);
  const activeGroupLabel = t[activeGroup?.labelKey ?? 'startGroup'];
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
      <div className="sf-docs-eyebrow">SENDFLOW / DEVELOPERS</div>
      <h1 className="sf-docs-title">{t.homeTitle}</h1>
      <p className="sf-docs-lede">{t.homeSub}</p>
      <div className="sf-docs-hero-actions">
        <Link href="/docs/getting-started" className="sf-docs-primary-action" data-testid="link-docs-start">{t.heroStart}<ArrowRight size={15} /></Link>
        <Link href="/docs/api-reference" className="sf-docs-secondary-action" data-testid="link-docs-explore-api">{t.heroApi}</Link>
      </div>
      <div className="sf-docs-meta"><span className="sf-docs-status"><i className="sf-docs-status-dot" />{t.badge}</span><span>{t.prod}</span></div>
      <StatusNotice language={language} />
      <section className="sf-docs-section">
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
    const hasStatus = ['auth', 'direct', 'hosted', 'api', 'webhooks', 'ref'].includes(pageKey);
    return (
      <>
        <div className="sf-docs-breadcrumb"><Link href="/docs">{t.breadcrumb}</Link><ChevronRight size={12} /><span>{t[pageKey] ?? t.home}</span></div>
        <div className="sf-docs-eyebrow">SENDFLOW / {activeGroupLabel.toUpperCase()}</div>
        <h1 className="sf-docs-title">{title}</h1>
        <p className="sf-docs-lede">{description}</p>
        <div className="sf-docs-meta"><span className="sf-docs-status"><i className="sf-docs-status-dot" />{hasStatus ? t.endpointStatus : t.lastUpdated}</span></div>
        {hasStatus && <StatusNotice language={language} />}
        {pageKey === 'start' && <>
          <section className="sf-docs-section"><h2>{t.whatIs}</h2><p>{t.whatIsText}</p>
            <div className="sf-docs-steps">
              {localizedLists[language].stepTitles.map((heading, index) => <div className="sf-docs-step" key={heading}><span className="sf-docs-step-index">0{index + 1}</span><div><strong>{heading}</strong><p>{localizedLists[language].stepTexts[index]}</p></div></div>)}
            </div>
          </section>
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><ul className="sf-docs-list"><li>{t.notDocumentedText}</li><li>{t.noCredentials}</li><li>{t.prod}</li></ul></section>
        </>}
        {pageKey === 'auth' && <>
          <section className="sf-docs-section"><h2>{t.notDocumented}</h2><p>{t.notDocumentedText}</p><div className="sf-docs-callout">{t.serverOnly}</div><CodePanel language={language} label={t.placeholder} /></section>
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><ul className="sf-docs-list"><li>{t.noCredentials}</li><li>{t.notDocumentedText}</li></ul></section>
        </>}
        {(pageKey === 'direct' || pageKey === 'hosted') && <>
          <section className="sf-docs-section"><h2>{t.model}</h2><p>{pageKey === 'direct' ? t.modelTextDirect : t.modelTextHosted}</p><CodePanel language={language} label={t.placeholder} /></section>
          <section className="sf-docs-section"><h2>{t.responsibilities}</h2><ul className="sf-docs-list">{localizedLists[language].responsibilitiesText.map((line) => <li key={line}>{line}</li>)}</ul></section>
          <section className="sf-docs-section"><h2>{t.prerequisites}</h2><p>{t.notDocumentedText}</p></section>
        </>}
        {pageKey === 'api' && <>
          <section className="sf-docs-section"><h2>{t.reference}</h2><p>{t.referenceIntro}</p>
            <div className="sf-docs-endpoints">
              {apiEndpointInventory.map((endpoint) => (
                <article className="sf-docs-endpoint" key={endpoint.path} data-testid={`endpoint-card-${endpoint.method.toLowerCase()}-${endpoint.path.split('/').at(-1)}`}>
                  <div className="sf-docs-endpoint-head">
                    <span className={`sf-docs-method-badge is-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                    <code>{endpoint.path}</code>
                    <span className="sf-docs-endpoint-pending">{t.badge}</span>
                  </div>
                  <p>{t[endpoint.description]}</p>
                  <div className="sf-docs-endpoint-access"><span>{t.endpointAccess}</span><strong>{t[endpoint.access]}</strong></div>
                </article>
              ))}
            </div>
            <p className="sf-docs-endpoint-note">{t.availableChoicesNote}</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="sf-docs-reference-table"><thead><tr><th>{t.tableArea}</th><th>{t.tableStatus}</th><th>{t.tableDescription}</th></tr></thead>
                <tbody>{localizedLists[language].tableRows.map((row) => (
                  <tr key={row[0]}>
                    <td data-label={t.tableArea}>{row[0]}</td>
                    <td data-label={t.tableStatus}>{row[1]}</td>
                    <td data-label={t.tableDescription}>{row[2]}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className="sf-docs-section"><h2>{t.placeholder}</h2><CodePanel language={language} label={t.codeLabel} /></section>
        </>}
        {pageKey === 'webhooks' && <>
          <section className="sf-docs-section"><h2>{t.webhookEvents}</h2><p>{t.webhookEventsSub}</p>
            <div className="sf-docs-card" style={{ marginTop: 15 }}>
              <div className="sf-docs-card-top"><span className="sf-docs-card-icon"><Webhook size={18} /></span><span className="sf-docs-status">{t.badge}</span></div>
              <h3>{t.eventNames}</h3>
              <ul className="sf-docs-list"><li><code className="sf-docs-inline-code">payment.succeeded</code></li><li><code className="sf-docs-inline-code">payment.failed</code></li></ul>
            </div>
          </section>
          <section className="sf-docs-section"><h2>{t.delivery}</h2><p>{t.deliveryText}</p><CodePanel language={language} label={t.placeholder} /></section>
        </>}
        {pageKey === 'ref' && <>
          <section className="sf-docs-section"><h2>{t.security}</h2><p>{t.securityText}</p></section>
          <section className="sf-docs-section"><h2>{t.errors}</h2><p>{t.errorsText}</p></section>
          <section className="sf-docs-section"><h2>{t.idempotency}</h2><p>{t.idempotencyText}</p></section>
          <section className="sf-docs-section"><h2>{t.expiration}</h2><p>{t.expirationText}</p></section>
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
          <Link href="/sign-in" className="sf-docs-dashboard" data-testid="link-docs-dashboard"><ArrowRight size={14} /><span>{t.dashboard}</span></Link>
          <button type="button" className="sf-docs-lang" onClick={() => setLanguage((current) => current === 'fr' ? 'en' : 'fr')} aria-label={language === 'fr' ? 'Switch to English' : 'Passer en français'} data-testid="button-docs-language">{language === 'fr' ? 'EN' : 'FR'}</button>
        </div>
      </header>
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
          <article className="sf-docs-content" key={`${path}-${language}`}>{pageKey === 'home' ? renderHome() : renderDocument()}</article>
          <footer className="sf-docs-footer">
            <span>{t.copyright} · {t.lastUpdated}</span>
            <div className="sf-docs-footer-links"><Link href="/docs/reference" data-testid="link-docs-footer-security">{t.security}</Link><Link href="/docs/webhooks" data-testid="link-docs-footer-webhooks">{t.navWebhooks}</Link><a href="mailto:support@sendflow01.com" data-testid="link-docs-footer-support">{t.contact}</a></div>
          </footer>
        </main>
      </div>
    </div>
  );
}
