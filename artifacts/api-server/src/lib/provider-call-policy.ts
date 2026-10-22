export type ExternalProviderName = "Didit" | "eSMS Verify";

export class ExternalProviderCallUnavailableError extends Error {
  readonly provider: ExternalProviderName;

  constructor(provider: ExternalProviderName) {
    super(`${provider} outbound requests are disabled outside production`);
    this.name = "ExternalProviderCallUnavailableError";
    this.provider = provider;
  }
}

export function assertExternalProviderCallsAllowed(
  provider: ExternalProviderName,
): void {
  if (process.env.NODE_ENV !== "production") {
    throw new ExternalProviderCallUnavailableError(provider);
  }
}
