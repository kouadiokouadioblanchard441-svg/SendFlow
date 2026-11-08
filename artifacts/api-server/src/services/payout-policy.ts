import { calculateTransferQuoteAmounts } from "../lib/transfer-quote-policy";

export const PAYOUT_EXECUTION_ENABLED = false;

export type PayoutFeePayer = "merchant" | "beneficiary";

export type PayoutQuoteInput = {
  amountMinor: number;
  currency: "XOF";
  countryCode: string;
  operatorId: string;
  feePayer: PayoutFeePayer;
};

export type PayoutQuoteConfiguration = {
  country: {
    countryCode: string;
    phonePrefix: string;
    minPhoneDigits: number;
    maxPhoneDigits: number;
    enabled: boolean;
    payoutEnabled: boolean;
  } | null;
  operator: {
    operatorId: string;
    countryCode: string;
    enabled: boolean;
    payoutEnabled: boolean;
  } | null;
  feePercent: number | null;
  pricingVersion: number | null;
  minimumPayoutMinor: number;
  maximumTransferMinor: number;
  maximumPayoutDailyMinor: number | null;
  executionRouteEnabled: boolean;
};

export class PayoutPolicyError extends Error {
  readonly statusCode: 400 | 403 | 409 | 422 | 503;

  constructor(
    statusCode: 400 | 403 | 409 | 422 | 503,
    message: string,
  ) {
    super(message);
    this.name = "PayoutPolicyError";
    this.statusCode = statusCode;
  }
}

export function assertPayoutWalletCanCover(availableBalanceMinor: number, totalDebitMinor: number): void {
  if (!Number.isSafeInteger(totalDebitMinor) || totalDebitMinor <= 0) {
    throw new PayoutPolicyError(400, "Le montant total du versement est invalide.");
  }
  if (!Number.isSafeInteger(availableBalanceMinor) || availableBalanceMinor < totalDebitMinor) {
    throw new PayoutPolicyError(422, "Le solde disponible SendFlow est insuffisant.");
  }
}

export function normalizePayoutPhone(phoneNumber: string, country: PayoutQuoteConfiguration["country"]) {
  const normalized = phoneNumber.trim();
  if (!country || !/^\+[1-9][0-9]{7,14}$/.test(normalized)
    || !normalized.startsWith(country.phonePrefix)) {
    throw new PayoutPolicyError(400, "Le numéro du bénéficiaire ne correspond pas au pays choisi.");
  }
  const national = normalized.slice(country.phonePrefix.length);
  if (!/^[0-9]+$/.test(national)
    || national.length < country.minPhoneDigits
    || national.length > country.maxPhoneDigits) {
    throw new PayoutPolicyError(400, "La longueur du numéro du bénéficiaire est invalide.");
  }
  return normalized;
}

export function calculatePayoutQuote(input: PayoutQuoteInput, configuration: PayoutQuoteConfiguration) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.currency !== "XOF") {
    throw new PayoutPolicyError(400, "Montant ou devise invalide.");
  }
  if (!configuration.country?.enabled || !configuration.country.payoutEnabled
    || !configuration.operator?.enabled || !configuration.operator.payoutEnabled
    || configuration.operator.countryCode !== configuration.country.countryCode) {
    throw new PayoutPolicyError(403, "Ce pays ou cet opérateur n’est pas autorisé pour les payouts.");
  }
  if (!configuration.executionRouteEnabled) {
    throw new PayoutPolicyError(503, "Le canal de versement SendFlow n’est pas disponible.");
  }
  if (configuration.feePercent === null || configuration.pricingVersion === null
    || !Number.isFinite(configuration.feePercent)
    || configuration.feePercent < 0 || configuration.feePercent > 100) {
    throw new PayoutPolicyError(503, "Le tarif payout de cet opérateur n’est pas configuré.");
  }
  if (!Number.isSafeInteger(configuration.maximumPayoutDailyMinor)
    || (configuration.maximumPayoutDailyMinor ?? 0) < configuration.minimumPayoutMinor) {
    throw new PayoutPolicyError(503, "Le plafond payout journalier n’est pas configuré.");
  }
  if (input.amountMinor < configuration.minimumPayoutMinor
    || input.amountMinor > configuration.maximumTransferMinor) {
    throw new PayoutPolicyError(400, "Le montant est en dehors des limites payout configurées.");
  }
  const amounts = calculateTransferQuoteAmounts(
    input.amountMinor,
    configuration.feePercent,
    input.feePayer === "merchant",
  );
  if (!amounts) throw new PayoutPolicyError(400, "Le calcul du payout dépasse les montants autorisés.");
  if (amounts.totalDebitMinor > configuration.maximumTransferMinor) {
    throw new PayoutPolicyError(400, "Le débit total dépasse la limite configurée.");
  }
  if (configuration.maximumPayoutDailyMinor !== null
    && amounts.totalDebitMinor > configuration.maximumPayoutDailyMinor) {
    throw new PayoutPolicyError(400, "Le débit total dépasse le plafond payout journalier.");
  }

  return {
    currency: "XOF" as const,
    amountMinor: input.amountMinor,
    feeMinor: amounts.feeMinor,
    totalDebitMinor: amounts.totalDebitMinor,
    beneficiaryAmountMinor: amounts.recipientAmountMinor,
    feePayer: input.feePayer,
    minimumPayoutMinor: configuration.minimumPayoutMinor,
    maximumPayoutDailyMinor: configuration.maximumPayoutDailyMinor,
    pricingVersion: configuration.pricingVersion,
    quoteExpiresAt: new Date(Date.now() + 120_000).toISOString(),
  };
}

export function isMatchingPayoutSettlementEvidence(
  payout: {
    executionReferenceHash: string;
    beneficiaryAmountMinor: number;
    currency: string;
    countryCode: string;
    operatorId: string;
    beneficiaryPhoneHash: string;
    expectedExecutionAccountHash: string;
    expectedExecutionChannelId: string;
  },
  evidence: {
    executionReferenceHash: string;
    executionStatus: "SUCCEEDED" | "FAILED";
    amountMinor: number;
    currency: string;
    countryCode: string;
    operatorId: string;
    beneficiaryPhoneHash: string;
    executionAccountHash: string;
    executionChannelId: string;
    operation: string;
    verificationPassed: boolean;
  },
  expectedStatus: "SUCCEEDED" | "FAILED",
) {
  return evidence.verificationPassed
    && evidence.executionStatus === expectedStatus
    && evidence.executionReferenceHash === payout.executionReferenceHash
    && evidence.amountMinor === payout.beneficiaryAmountMinor
    && evidence.currency === payout.currency
    && evidence.countryCode === payout.countryCode
    && evidence.operatorId === payout.operatorId
    && evidence.beneficiaryPhoneHash === payout.beneficiaryPhoneHash
    && evidence.executionAccountHash === payout.expectedExecutionAccountHash
    && evidence.executionChannelId === payout.expectedExecutionChannelId
    && evidence.operation === "payout";
}
