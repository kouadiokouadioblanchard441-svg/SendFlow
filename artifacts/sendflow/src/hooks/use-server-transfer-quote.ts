import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createCustomerTransferQuote,
  type TransferQuoteInput,
} from '@workspace/api-client-react';
import { serverQuoteQueryOptions, transferQuoteKey, visibleServerQuote } from '@/lib/server-transfer-quote';

function cancelledQuote() {
  return new DOMException('Quote input changed', 'AbortError');
}

export function useServerTransferQuote(input: TransferQuoteInput | null, enabled: boolean) {
  const key = transferQuoteKey(input);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const activeKey = useRef<string | null>(null);
  activeKey.current = enabled ? key : null;
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledKey(key), 500);
    return () => window.clearTimeout(timer);
  }, [key]);
  useEffect(() => {
    activeKey.current = enabled ? key : null;
    return () => { activeKey.current = null; };
  }, [enabled, key]);

  const query = useQuery(serverQuoteQueryOptions(input, enabled, settledKey, createCustomerTransferQuote));
  // Changing an input invalidates the displayed quote synchronously, before
  // the debounce effect. A failed refresh must not revive cached totals.
  const data = visibleServerQuote(enabled, key, settledKey, query);
  return {
    data,
    isPending: enabled && input !== null && (key !== settledKey || query.isFetching),
    isError: enabled && input !== null && key === settledKey && query.isError && !query.isFetching,
    error: query.error,
    async mutateAsync({ data: requestedInput }: { data: TransferQuoteInput }) {
      const requestedKey = transferQuoteKey(requestedInput);
      if (requestedKey !== activeKey.current) throw cancelledQuote();
      try {
        const refreshed = await query.refetch({ throwOnError: true });
        if (requestedKey !== activeKey.current) throw cancelledQuote();
        if (!refreshed.data) throw new Error('Server quote unavailable');
        return refreshed.data;
      } catch (error) {
        if (requestedKey !== activeKey.current) throw cancelledQuote();
        throw error;
      }
    },
  };
}
