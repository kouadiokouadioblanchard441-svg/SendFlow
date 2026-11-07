import { SENDFLOW_PAYMENT_ORIGIN } from './payment-host.ts';

export interface LinkFlowShareTargets {
  url: string;
  whatsappUrl: string;
  telegramUrl: string;
  facebookUrl: string;
}

export function getLinkFlowShareOrigin(currentOrigin: string, isProduction: boolean): string {
  if (isProduction) return SENDFLOW_PAYMENT_ORIGIN;

  const currentUrl = new URL(currentOrigin);
  if (!['http:', 'https:'].includes(currentUrl.protocol) || currentUrl.username || currentUrl.password) {
    throw new TypeError('Invalid payment-link origin');
  }
  return currentUrl.origin;
}

export function buildLinkFlowShareTargets({
  origin,
  basePath,
  sharePath,
  title,
}: {
  origin: string;
  basePath: string;
  sharePath: string;
  title: string;
}): LinkFlowShareTargets {
  const trustedOrigin = new URL(origin);
  if (!['http:', 'https:'].includes(trustedOrigin.protocol) || trustedOrigin.username || trustedOrigin.password) {
    throw new TypeError('Invalid payment-link origin');
  }
  if (!sharePath.startsWith('/') || sharePath.startsWith('//') || sharePath.includes('\\') || /[?#\u0000-\u001f]/.test(sharePath)) {
    throw new TypeError('Invalid payment-link path');
  }

  const normalizedBase = basePath.replace(/\/+$/, '');
  const paymentUrl = new URL(`${normalizedBase}${sharePath}`, trustedOrigin.origin);
  if (paymentUrl.origin !== trustedOrigin.origin) {
    throw new TypeError('Payment link must stay on the current origin');
  }

  const safeTitle = title.trim() || 'Lien de paiement SendFlow';
  const encodedUrl = encodeURIComponent(paymentUrl.href);
  const encodedTitle = encodeURIComponent(safeTitle);

  return {
    url: paymentUrl.href,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`${safeTitle} — ${paymentUrl.href}`)}`,
    telegramUrl: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  };
}
