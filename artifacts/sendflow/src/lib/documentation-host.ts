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

export function getDocumentationPageKey(pathname: string): string | null {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalizedPath === '/') return 'home';
  return Object.prototype.hasOwnProperty.call(DOCUMENTATION_PAGE_KEYS, normalizedPath)
    ? DOCUMENTATION_PAGE_KEYS[normalizedPath]
    : null;
}
