export type PaymentLimitValues = {
  minimumDepositMinor: number;
  minimumPayoutMinor: number;
  maximumPayoutDailyMinor: number | null;
  minimumInterNetworkMinor: number;
  maximumTransferMinor: number;
  maximumPayinMinor: number;
};

export const DEFAULT_PAYMENT_LIMITS: Readonly<PaymentLimitValues> = Object.freeze({
  minimumDepositMinor: 200,
  minimumPayoutMinor: 200,
  maximumPayoutDailyMinor: null,
  minimumInterNetworkMinor: 1,
  maximumTransferMinor: 10_000_000,
  maximumPayinMinor: 2_000_000,
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

export function getMinimumForTransfer(
  kind: "deposit" | "inter-network" | "international",
  limits: PaymentLimitValues,
) {
  if (kind === "deposit") return limits.minimumDepositMinor;
  if (kind === "inter-network") return limits.minimumInterNetworkMinor;
  return limits.minimumPayoutMinor;
}
