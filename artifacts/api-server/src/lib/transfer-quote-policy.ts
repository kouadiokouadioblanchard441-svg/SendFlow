export type TransferQuoteAmounts = {
  feeMinor: number;
  recipientAmountMinor: number;
  totalDebitMinor: number;
};

export function calculateTransferQuoteAmounts(
  amountMinor: number,
  feePercent: number,
  senderPaysFees: boolean,
): TransferQuoteAmounts | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) return null;
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) return null;

  const percentBasisPoints = Math.round(feePercent * 10_000);
  if (Math.abs(feePercent * 10_000 - percentBasisPoints) > 1e-7) return null;
  const numerator = BigInt(amountMinor) * BigInt(percentBasisPoints);
  const fee = (numerator + 999_999n) / 1_000_000n;
  const recipient = senderPaysFees ? BigInt(amountMinor) : BigInt(amountMinor) - fee;
  const totalDebit = senderPaysFees ? BigInt(amountMinor) + fee : BigInt(amountMinor);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (fee > maxSafe || recipient < 1n || recipient > maxSafe || totalDebit > maxSafe) return null;

  return {
    feeMinor: Number(fee),
    recipientAmountMinor: Number(recipient),
    totalDebitMinor: Number(totalDebit),
  };
}
