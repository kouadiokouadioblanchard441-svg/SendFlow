import {
  getGetPublicPaymentLimitsQueryKey,
  useGetPublicPaymentLimits,
} from "@workspace/api-client-react";

export function usePaymentLimits() {
  return useGetPublicPaymentLimits({
    query: {
      queryKey: getGetPublicPaymentLimitsQueryKey(),
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });
}
