import { isSendFlowDocumentationHost } from './documentation-host.ts';
import { isSendFlowPaymentHost } from './payment-host.ts';

const SENDFLOW_MAIN_SITE_ORIGIN = 'https://sendflow.africa';

export function getNotFoundHomeHref(hostname: string): string {
  if (isSendFlowDocumentationHost(hostname)) return '/docs';
  if (isSendFlowPaymentHost(hostname)) return SENDFLOW_MAIN_SITE_ORIGIN;
  return '/';
}
