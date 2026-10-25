import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import type { CustomerSessionContext } from "../lib/customer-session";

export const PAYMENT_LINK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PAYMENT_LINK_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
const paymentLinkImageMimeFormats = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

export const PAYMENT_LINK_CURRENCIES = [
  { code: "XOF", decimals: 0 },
  { code: "XAF", decimals: 0 },
  { code: "USD", decimals: 2 },
] as const;

const storedPaymentLinkCurrencyDecimals = {
  XOF: 0,
  XAF: 0,
  CHF: 2,
  NGN: 2,
  EUR: 2,
  USD: 2,
  CAD: 2,
} as const;

export function getPaymentLinkCurrencyDecimals(currency: string): number {
  const decimals = storedPaymentLinkCurrencyDecimals[
    currency as keyof typeof storedPaymentLinkCurrencyDecimals
  ];
  if (decimals === undefined) throw new Error("Devise enregistrée inconnue pour un lien de paiement.");
  return decimals;
}

export const PAYMENT_LINK_METHODS = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Carte" },
  { value: "all", label: "Tous" },
] as const;

export const PAYMENT_LINK_VALIDITIES = [
  { value: "hour", label: "1 heure" },
  { value: "day", label: "1 jour" },
  { value: "week", label: "1 semaine" },
  { value: "unlimited", label: "Illimitée" },
] as const;

const validityInMs = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  unlimited: null,
} as const;

export class PaymentLinkInputError extends Error {}
export class PaymentLinkIdempotencyConflict extends Error {}
export class PaymentLinkImageError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(status: 400 | 413 | 415, message: string) {
    super(message);
    this.status = status;
  }
}

export async function normalizePaymentLinkImage(
  source: Buffer,
  declaredMimeType: string,
): Promise<Buffer> {
  const expectedFormat = paymentLinkImageMimeFormats[
    declaredMimeType as keyof typeof paymentLinkImageMimeFormats
  ];
  if (!expectedFormat) {
    throw new PaymentLinkImageError(415, "Seuls les fichiers PNG, JPEG, GIF et WebP sont acceptés.");
  }
  if (source.length === 0) {
    throw new PaymentLinkImageError(400, "Le fichier image est vide.");
  }
  if (source.length > PAYMENT_LINK_IMAGE_MAX_BYTES) {
    throw new PaymentLinkImageError(413, "L’image dépasse la limite de 5 Mo.");
  }

  try {
    const decoder = sharp(source, {
      failOn: "error",
      limitInputPixels: 16_000_000,
      pages: 1,
      sequentialRead: true,
    });
    const metadata = await decoder.metadata();
    if (
      metadata.format !== expectedFormat
      || !metadata.width
      || !metadata.height
      || metadata.width > 8_000
      || metadata.height > 8_000
    ) {
      throw new PaymentLinkImageError(400, "Le contenu du fichier ne correspond pas à une image valide.");
    }

    const normalized = await decoder
      .rotate()
      .resize({ width: 1_600, height: 1_600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    if (normalized.length === 0) {
      throw new PaymentLinkImageError(400, "L’image n’a pas pu être traitée.");
    }
    if (normalized.length > PAYMENT_LINK_IMAGE_MAX_BYTES) {
      throw new PaymentLinkImageError(413, "L’image optimisée dépasse la limite de stockage.");
    }
    return normalized;
  } catch (error) {
    if (error instanceof PaymentLinkImageError) throw error;
    throw new PaymentLinkImageError(400, "Le fichier image est illisible ou invalide.");
  }
}

export type NormalizedPaymentLinkInput = {
  requestId: string;
  currency: typeof PAYMENT_LINK_CURRENCIES[number]["code"];
  amountMinor: number;
  linkName: string;
  description: string;
  paymentMethod: typeof PAYMENT_LINK_METHODS[number]["value"];
  validity: keyof typeof validityInMs;
  maximumUses: number | null;
  returnUrl: string | null;
  suffix: string | null;
  expiresAt: Date | null;
  requestHash: string;
};

function parseAmountMinor(amount: string, currency: string) {
  const currencyOption = PAYMENT_LINK_CURRENCIES.find((option) => option.code === currency);
  if (!currencyOption) throw new PaymentLinkInputError("Devise non prise en charge.");

  const [majorText, fractionalText = ""] = amount.split(".");
  if (!/^(0|[1-9][0-9]*)$/.test(majorText ?? "")) {
    throw new PaymentLinkInputError("Montant invalide.");
  }
  if (fractionalText.length > currencyOption.decimals) {
    throw new PaymentLinkInputError("Le montant contient trop de décimales pour cette devise.");
  }

  const scale = 10n ** BigInt(currencyOption.decimals);
  const fraction = currencyOption.decimals === 0
    ? 0n
    : BigInt((fractionalText + "0".repeat(currencyOption.decimals)).slice(0, currencyOption.decimals));
  const minor = BigInt(majorText) * scale + fraction;
  if (minor < 10n * scale) throw new PaymentLinkInputError("Le montant minimum est de 10.");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PaymentLinkInputError("Le montant dépasse la limite autorisée.");
  }
  return Number(minor);
}

function normalizeReturnUrl(value: string | null) {
  if (value === null) return null;
  if (value.length > 2048) throw new PaymentLinkInputError("L’adresse de retour est trop longue.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PaymentLinkInputError("L’adresse de retour est invalide.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new PaymentLinkInputError("L’adresse de retour doit être une URL HTTPS valide.");
  }
  return url.toString();
}

export function normalizePaymentLinkInput(
  input: {
    requestId: string;
    currency: typeof PAYMENT_LINK_CURRENCIES[number]["code"];
    amount: string;
    linkName: string;
    description: string;
    paymentMethod: typeof PAYMENT_LINK_METHODS[number]["value"];
    validity: keyof typeof validityInMs;
    maximumUses: number | null;
    returnUrl: string | null;
    suffix: string | null;
  },
  now = new Date(),
): NormalizedPaymentLinkInput {
  const linkName = input.linkName.trim();
  if (linkName.length < 2 || linkName.length > 120) {
    throw new PaymentLinkInputError("Le nom du lien doit contenir entre 2 et 120 caractères.");
  }
  const description = input.description.trim();
  if (description.length < 2 || description.length > 240) {
    throw new PaymentLinkInputError("La description doit contenir entre 2 et 240 caractères.");
  }
  const amountMinor = parseAmountMinor(input.amount, input.currency);
  const returnUrl = normalizeReturnUrl(input.returnUrl);
  if (input.suffix !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.suffix)) {
    throw new PaymentLinkInputError("Le suffixe du lien est invalide.");
  }
  if (input.maximumUses !== null
    && (!Number.isSafeInteger(input.maximumUses) || input.maximumUses < 1 || input.maximumUses > 999_999)) {
    throw new PaymentLinkInputError("La limite d’utilisations est invalide.");
  }
  const validityDuration = validityInMs[input.validity];
  if (validityDuration === undefined) throw new PaymentLinkInputError("La durée de validité est invalide.");

  const canonical = {
    currency: input.currency,
    amountMinor,
    linkName,
    description,
    paymentMethod: input.paymentMethod,
    validity: input.validity,
    maximumUses: input.maximumUses,
    returnUrl,
    suffix: input.suffix,
  };
  return {
    ...canonical,
    requestId: input.requestId,
    expiresAt: validityDuration === null ? null : new Date(now.getTime() + validityDuration),
    requestHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
  };
}

export function createPaymentLinkPublicToken() {
  return randomBytes(32).toString("base64url");
}

export function isPaymentLinkCreationAllowed(
  session: Pick<CustomerSessionContext, "paymentTestAccount">,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return environment.SENDFLOW_DATABASE_TARGET !== "shared-neon" || !session.paymentTestAccount;
}
