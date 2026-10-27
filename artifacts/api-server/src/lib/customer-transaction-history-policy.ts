type CustomerTransactionHistoryAmounts = {
  amountMinor: number;
  feeMinor: number;
  toOperator: string | null;
};

type LinkFlowHistoryAmounts = {
  attemptId: string | null;
  recipientTotalMinor: number | null;
};

export function projectCustomerTransactionHistoryValues(
  transaction: CustomerTransactionHistoryAmounts,
  linkFlow: LinkFlowHistoryAmounts,
) {
  if (!linkFlow.attemptId) {
    return {
      amountMinor: transaction.amountMinor,
      toOperator: transaction.toOperator,
    };
  }

  const recipientTotalMinor = linkFlow.recipientTotalMinor;
  if (
    recipientTotalMinor === null ||
    !Number.isSafeInteger(transaction.amountMinor) ||
    !Number.isSafeInteger(transaction.feeMinor) ||
    !Number.isSafeInteger(recipientTotalMinor) ||
    recipientTotalMinor <= 0 ||
    transaction.feeMinor < 0 ||
    recipientTotalMinor + transaction.feeMinor !== transaction.amountMinor
  ) {
    throw new Error("LinkFlow transaction history amounts are inconsistent");
  }

  return {
    amountMinor: recipientTotalMinor,
    toOperator: "sendflow",
  };
}
