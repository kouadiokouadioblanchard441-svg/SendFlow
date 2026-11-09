import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { reportGlobalApiError } from '@/lib/global-api-errors';
import { shouldShowGlobalQueryError } from '@/lib/safe-api-error';

export function getHttpStatus(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: number; response?: { status?: number } };
  return candidate.status ?? candidate.response?.status;
}

const reportedQueryErrors = new WeakSet<object>();

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined || reportedQueryErrors.has(query)) return;
      reportedQueryErrors.add(query);
      if (shouldShowGlobalQueryError(error)) reportGlobalApiError(error);
    },
    onSuccess: (_data, query) => {
      reportedQueryErrors.delete(query);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => reportGlobalApiError(error),
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = getHttpStatus(error);
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
