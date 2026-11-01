import {
  getGetCustomerServiceSettingsQueryKey,
  useGetCustomerServiceSettings,
} from "@workspace/api-client-react";

export function useCustomerServiceContact() {
  const query = useGetCustomerServiceSettings({
    query: {
      queryKey: getGetCustomerServiceSettingsQueryKey(),
      retry: false,
      staleTime: 0,
    },
  });
  const settings = query.data;
  const whatsappDigits = settings?.whatsappNumber?.replace(/\D/g, "") ?? "";

  return {
    query,
    contact: {
      phoneNumber: settings?.phoneNumber ?? null,
      phoneHref: settings?.phoneNumber ? `tel:${settings.phoneNumber}` : null,
      whatsappNumber: settings?.whatsappNumber ?? null,
      whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
      facebookLabel: settings?.facebookLabel ?? null,
      facebookHref: settings?.facebookUrl ?? null,
      playStoreHref: null,
    },
  };
}
