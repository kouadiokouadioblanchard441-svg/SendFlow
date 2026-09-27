import { useQuery } from '@tanstack/react-query';

export type CustomerTransactionRecord = {
  id: string;
  kind: 'deposit' | 'inter-network' | 'international';
  status: 'pending' | 'succeeded' | 'failed';
  fromOperator: string | null;
  toOperator: string | null;
  senderPhone: string;
  recipientPhone: string;
  currency: string;
  amountMinor: number;
  feeMinor: number;
  reference: string;
  providerReference: string | null;
  createdAt: string;
};

type CustomerTransactionList = {
  items: CustomerTransactionRecord[];
};

export class CustomerTransactionRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CustomerTransactionRequestError';
  }
}

async function requestCustomerTransactions<T>(
  url: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    const message = response.status === 401
      ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
      : response.status === 404
        ? 'Cette transaction est introuvable.'
        : 'Les données de transaction sont momentanément indisponibles.';
    throw new CustomerTransactionRequestError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export function useCustomerTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['customer-transactions', userId],
    enabled: Boolean(userId),
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ signal }) =>
      requestCustomerTransactions<CustomerTransactionList>('/api/me/transactions', signal),
  });
}

export function useCustomerTransaction(
  userId: string | undefined,
  transactionId: string,
) {
  return useQuery({
    queryKey: ['customer-transaction', userId, transactionId],
    enabled: Boolean(userId && transactionId),
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ signal }) =>
      requestCustomerTransactions<CustomerTransactionRecord>(
        `/api/me/transactions/${encodeURIComponent(transactionId)}`,
        signal,
      ),
  });
}