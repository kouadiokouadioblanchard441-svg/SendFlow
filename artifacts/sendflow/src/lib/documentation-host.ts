const SENDFLOW_DOCUMENTATION_HOST = 'apis.docs.sendflow.africa';

const DOCUMENTATION_PAGE_KEYS: Readonly<Record<string, string>> = {
  '/docs': 'home',
  '/docs/getting-started': 'start',
  '/docs/authentication': 'auth',
  '/docs/integrations/direct': 'direct',
  '/docs/integrations/hosted': 'hosted',
  '/docs/api-reference': 'direct',
  '/docs/webhooks': 'webhooks',
  '/docs/reference': 'ref',
};

export function isSendFlowDocumentationHost(hostname: string): boolean {
  return hostname.toLowerCase() === SENDFLOW_DOCUMENTATION_HOST;
}

export function isSendFlowDocumentationPreviewRoute(hostname: string, pathname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/:\d+$/, '');
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const isPreviewHost =
    normalizedHostname === 'localhost'
    || normalizedHostname === '127.0.0.1'
    || normalizedHostname.endsWith('.replit.dev');

  return isPreviewHost
    && (normalizedPath === '/docs' || normalizedPath.startsWith('/docs/'))
    && getDocumentationPageKey(normalizedPath) !== null;
}

export function getDocumentationPageKey(pathname: string): string | null {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalizedPath === '/') return 'home';
  return Object.prototype.hasOwnProperty.call(DOCUMENTATION_PAGE_KEYS, normalizedPath)
    ? DOCUMENTATION_PAGE_KEYS[normalizedPath]
    : null;
}
