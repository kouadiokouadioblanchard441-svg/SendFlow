import { getAllowedOrigins, getTrustedHost, normalizeHttpOrigin } from "./origin-policy.ts";

export function getCustomerBiometricOrigin(
  method: string,
  originHeader: string | undefined,
  hostHeader: string | undefined,
  environment: Parameters<typeof getAllowedOrigins>[0] = process.env,
) {
  let origin = normalizeHttpOrigin(originHeader);
  if (!origin && method.toUpperCase() === "GET") {
    const trustedHost = getTrustedHost(hostHeader, environment);
    if (trustedHost) {
      origin = [...getAllowedOrigins(environment)].find((configuredOrigin) =>
        new URL(configuredOrigin).host.toLowerCase() === trustedHost.toLowerCase(),
      ) ?? null;
    }
  }
  if (!origin || !getAllowedOrigins(environment).has(origin)) return null;

  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
  return { origin, rpId: parsed.hostname };
}
