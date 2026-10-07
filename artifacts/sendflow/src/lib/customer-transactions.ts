import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getCustomerTransactions,
  useGetCustomerTransaction,
  type CustomerTransaction,
} from '@workspace/api-client-react';

export type CustomerTransactionRecord = CustomerTransaction;

export function useCustomerTransactions(
  userId: string | undefined,
  search: string,
  limit = 50,
) {
  return useInfiniteQuery({
    queryKey: ['customer-transactions', userId, search, limit],
    enabled: Boolean(userId),
    staleTime: 0,
    gcTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) =>
      getCustomerTransactions(
        { cursor: pageParam, search: search || undefined, limit },
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useCustomerTransaction(
  userId: string | undefined,
  transactionId: string,
) {
  return useGetCustomerTransaction(transactionId, {
    query: {
      queryKey: ['customer-transaction', userId, transactionId],
      enabled: Boolean(userId && transactionId),
      staleTime: 0,
      gcTime: 0,
    },
  });
}