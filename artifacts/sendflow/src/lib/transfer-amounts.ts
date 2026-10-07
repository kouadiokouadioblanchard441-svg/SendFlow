export type TransferAmountBreakdown = {
  feeAmount: number | null;
  recipientAmount: number | null;
  totalDebit: number | null;
};

export function calculateTransferAmountBreakdown(
  amount: number,
  feeRate: number | undefined,
  senderPaysFees: boolean,
): TransferAmountBreakdown {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError('Transfer amount must be a non-negative safe integer.');
  }
  if (feeRate !== undefined && (!Number.isFinite(feeRate) || feeRate < 0)) {
    throw new RangeError('Transfer fee rate must be a finite non-negative number.');
  }
  if (feeRate === undefined) {
    return { feeAmount: null, recipientAmount: null, totalDebit: null };
  }

  const feeAmount = Math.ceil(amount * feeRate);
  const recipientAmount = senderPaysFees ? amount : Math.max(amount - feeAmount, 0);
  const totalDebit = senderPaysFees ? amount + feeAmount : amount;
  if (![feeAmount, recipientAmount, totalDebit].every(Number.isSafeInteger)) {
    throw new RangeError('Transfer totals exceed the supported safe integer range.');
  }

  return { feeAmount, recipientAmount, totalDebit };
}
