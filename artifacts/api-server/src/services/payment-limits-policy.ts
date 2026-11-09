export type PaymentLimitValues = {
  minimumDepositMinor: number;
  minimumPayoutMinor: number;
  maximumPayoutDailyMinor: number | null;
  minimumInterNetworkMinor: number;
  maximumTransferMinor: number;
  maximumPayinMinor: number;
  maximumUnverifiedIncomingMinor: number;
};

export const DEFAULT_PAYMENT_LIMITS: Readonly<PaymentLimitValues> = Object.freeze({
  minimumDepositMinor: 200,
  minimumPayoutMinor: 200,
  maximumPayoutDailyMinor: null,
  minimumInterNetworkMinor: 1,
  maximumTransferMinor: 10_000_000,
  maximumPayinMinor: 2_000_000,
  maximumUnverifiedIncomingMinor: 20_000,
});

export function isValidPaymentLimitValues(values: PaymentLimitValues): boolean {
  const amounts = [
    values.minimumDepositMinor,
    values.minimumPayoutMinor,
    values.minimumInterNetworkMinor,
    values.maximumTransferMinor,
    values.maximumPayinMinor,
  ];
  if (!amounts.every((amount) => Number.isSafeInteger(amount) && amount > 0)) return false;
  if (!Number.isSafeInteger(values.maximumUnverifiedIncomingMinor)
    || values.maximumUnverifiedIncomingMinor < 0
    || values.maximumUnverifiedIncomingMinor > 2_147_483_647) return false;
  if (values.maximumPayoutDailyMinor !== null
    && (!Number.isSafeInteger(values.maximumPayoutDailyMinor)
      || values.maximumPayoutDailyMinor < values.minimumPayoutMinor)) return false;

  return values.minimumDepositMinor >= 200
    && values.minimumDepositMinor <= values.maximumTransferMinor
    && values.minimumDepositMinor <= values.maximumPayinMinor
    && values.minimumPayoutMinor >= 200
    && values.minimumPayoutMinor <= 2_000_000
    && values.minimumPayoutMinor <= values.maximumTransferMinor
    && values.minimumInterNetworkMinor <= values.maximumTransferMinor
    && values.maximumTransferMinor <= 10_000_000
    && values.maximumPayinMinor >= 200
    && values.maximumPayinMinor <= 2_000_000;
}

export function hasReachedUnverifiedIncomingLimit(
  receivedMinor: number,
  limitMinor: number,
): boolean {
  if (!Number.isSafeInteger(receivedMinor) || receivedMinor < 0
    || !Number.isSafeInteger(limitMinor) || limitMinor < 0) {
    throw new Error("Invalid unverified incoming limit values");
  }
  return receivedMinor >= limitMinor;
}

export function isUnverifiedOutgoingBlocked(
  identityVerified: boolean,
  receivedMinor: number,
  limitMinor: number,
): boolean {
  return !identityVerified && hasReachedUnverifiedIncomingLimit(receivedMinor, limitMinor);
}

export function addUnverifiedIncomingAmount(
  currentMinor: number,
  creditedMinor: number,
  identityVerified: boolean,
): number {
  if (!Number.isSafeInteger(currentMinor) || currentMinor < 0
    || !Number.isSafeInteger(creditedMinor) || creditedMinor < 0) {
    throw new Error("Invalid unverified incoming amount");
  }
  if (identityVerified) return currentMinor;
  return Math.min(Number.MAX_SAFE_INTEGER, currentMinor + creditedMinor);
}

export function getMinimumForTransfer(
  kind: "deposit" | "inter-network" | "international",
  limits: PaymentLimitValues,
) {
  if (kind === "deposit") return limits.minimumDepositMinor;
  if (kind === "inter-network") return limits.minimumInterNetworkMinor;
  return limits.minimumPayoutMinor;
}
