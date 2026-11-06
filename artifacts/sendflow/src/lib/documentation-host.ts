const SENDFLOW_DOCUMENTATION_HOST = 'apis.docs.sendflow.africa';

export function isSendFlowDocumentationHost(hostname: string): boolean {
  return hostname.toLowerCase() === SENDFLOW_DOCUMENTATION_HOST;
}
