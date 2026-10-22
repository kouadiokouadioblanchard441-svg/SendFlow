import type { TransferQuoteInput, TransferQuoteResult } from '@workspace/api-client-react';

// Intent identity only: never persist this key (which includes phone numbers).
export function transferQuoteKey(input: TransferQuoteInput | null): string | null {
  return input ? JSON.stringify([
    input.kind, input.amountMinor, input.senderPaysFees,
    input.sourceOperatorId ?? null, input.destinationOperatorId ?? null,
    input.destinationCountryCode ?? null, input.senderPhone ?? null, input.recipientPhone ?? null,
  ]) : null;
}

export function isQuoteForInput(input: TransferQuoteInput, quote: TransferQuoteResult): boolean {
  return !!quote && quote.kind === input.kind && quote.amountMinor === input.amountMinor
    && quote.senderPaysFees === input.senderPaysFees && quote.currency === 'XOF'
    && Number.isSafeInteger(quote.feeMinor) && quote.feeMinor >= 0
    && Number.isSafeInteger(quote.recipientAmountMinor) && quote.recipientAmountMinor > 0
    && Number.isSafeInteger(quote.totalDebitMinor) && quote.totalDebitMinor > 0
    && Number.isFinite(quote.feePercent) && quote.feePercent >= 0 && quote.feePercent <= 100;
}

type QuoteRequester = (input: TransferQuoteInput, options: { signal: AbortSignal }) => Promise<TransferQuoteResult>;

export function serverQuoteQueryOptions(
  input: TransferQuoteInput | null, enabled: boolean, settledKey: string | null, request: QuoteRequester,
) {
  const key = transferQuoteKey(input);
  return {
    queryKey: ['customer-transfer-quote', key],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (!input) throw new DOMException('Quote input changed', 'AbortError');
      const result = await request(input, { signal });
      if (!isQuoteForInput(input, result)) throw new Error('Invalid server quote');
      return result;
    },
    enabled: enabled && input !== null && key === settledKey,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always' as const,
    placeholderData: undefined,
  };
}

export function visibleServerQuote(
  enabled: boolean, key: string | null, settledKey: string | null,
  query: { isSuccess: boolean; isFetching: boolean; data?: TransferQuoteResult },
) {
  return enabled && key !== null && key === settledKey && query.isSuccess && !query.isFetching
    ? query.data : undefined;
}

export function serverQuoteAmounts(quote: TransferQuoteResult | undefined) {
  // Copy server fields verbatim. No fee, rounding or total calculation here.
  return {
    feeAmount: quote?.feeMinor ?? null,
    recipientAmount: quote?.recipientAmountMinor ?? null,
    totalDebit: quote?.totalDebitMinor ?? null,
  };
}

export function formatQuoteAmount(amount: number | null): string {
  return amount === null ? 'À confirmer' : amount.toLocaleString('fr-FR');
}

export function formatServerFeePercent(percent: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(percent)} %`;
}
