import {
  getGetPublicPaymentLimitsQueryKey,
  useGetPublicPaymentLimits,
} from "@workspace/api-client-react";

export function usePaymentLimits(enabled = true) {
  return useGetPublicPaymentLimits({
    query: {
      queryKey: getGetPublicPaymentLimitsQueryKey(),
      enabled,
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });
}
