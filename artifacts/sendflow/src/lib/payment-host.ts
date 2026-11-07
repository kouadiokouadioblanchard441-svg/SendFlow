export const SENDFLOW_PAYMENT_HOST = 'payin.merchant.command.sendflow.africa';
export const SENDFLOW_PAYMENT_ORIGIN = `https://${SENDFLOW_PAYMENT_HOST}`;

export function isSendFlowPaymentHost(hostname: string): boolean {
  return hostname.toLowerCase() === SENDFLOW_PAYMENT_HOST;
}
