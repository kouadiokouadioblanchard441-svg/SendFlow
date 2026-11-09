import { createHash } from "node:crypto";
import { createSensitiveDataLookupIndex } from "../lib/sensitive-data-crypto.ts";
import { isFeexpayLiveExecutionAllowed } from "../providers/feexpay/live-runtime.ts";
import type { FeexpayReceipt } from "../providers/feexpay/client.ts";
import { feexpayChannels, feexpayCountries } from "../providers/feexpay/catalog.ts";
import { isPaydunyaLiveExecutionAllowed } from "../providers/paydunya/client.ts";

export type LinkFlowPublicState = "waiting" | "uncertain" | "succeeded" | "failed";

type Environment = Record<string, string | undefined>;

export function isLinkFlowProviderExecutionEnabled(
  providerCode: string,
  environment: Environment = process.env,
) {
  if (providerCode === "feexpay") {
    return environment.FEEXPAY_LINKFLOW_ENABLED === "true"
      && environment.FEEXPAY_MODE === "live"
      && environment.FEEXPAY_EXECUTION_HOST === "plesk"
      && environment.SENDFLOW_DATABASE_TARGET === "production"
      && Boolean(environment.FEEXPAY_API_KEY)
      && Boolean(environment.FEEXPAY_SHOP_ID)
      && isFeexpayLiveExecutionAllowed(environment);
  }
  if (providerCode === "paydunya") {
    return environment.PAYDUNYA_LINKFLOW_ENABLED === "true"
      && environment.PAYDUNYA_MODE === "live"
      && environment.PAYDUNYA_EXECUTION_HOST === "plesk"
      && environment.SENDFLOW_DATABASE_TARGET === "production"
      && Boolean(environment.PAYDUNYA_MASTER_KEY)
      && Boolean(environment.PAYDUNYA_PRIVATE_KEY)
      && Boolean(environment.PAYDUNYA_TOKEN)
      && isPaydunyaLiveExecutionAllowed(environment);
  }
  return false;
}

export function isLinkFlowPaymentExecutionEnabled(environment: Environment = process.env) {
  return isLinkFlowProviderExecutionEnabled("feexpay", environment)
    || isLinkFlowProviderExecutionEnabled("paydunya", environment);
}

export function toProviderPhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function buildLinkFlowRequestHash(input: {
  linkId: string;
  countryCode: string;
  operatorId: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  amountMinor: number;
  idempotencyKey: string;
  otp?: string;
  otpFlow?: "provider_challenge" | "pre_acquired";
}) {
  const phoneHash = createSensitiveDataLookupIndex(input.phoneNumber, "transaction-sender-phone");
  const otpFingerprint = input.otpFlow === "provider_challenge" || !input.otp
    ? null
    : createSensitiveDataLookupIndex(input.otp, "linkflow-request-otp");
  return createSensitiveDataLookupIndex(JSON.stringify({
    linkId: input.linkId,
    countryCode: input.countryCode.toLowerCase(),
    operatorId: input.operatorId,
    phoneHash,
    firstName: input.firstName.trim().normalize("NFKC"),
    lastName: input.lastName.trim().normalize("NFKC"),
    amountMinor: input.amountMinor,
    idempotencyKey: input.idempotencyKey,
    otpFlow: input.otpFlow ?? null,
    otpFingerprint,
  }), "linkflow-request-fingerprint");
}

export function deriveLinkFlowPollToken(linkId: string, idempotencyKey: string) {
  return createSensitiveDataLookupIndex(
    `linkflow-poll-v1:${linkId}:${idempotencyKey}`,
    "linkflow-poll-token-seed",
  );
}

export function hashLinkFlowPollToken(token: string) {
  return createSensitiveDataLookupIndex(token, "linkflow-poll-token-hash");
}

export function resolveInitialProviderState(receipt: FeexpayReceipt | null): LinkFlowPublicState {
  // The POST acknowledgement is not settlement evidence, even when it says SUCCESSFUL.
  return receipt?.reference ? "waiting" : "uncertain";
}

export function resolveVerifiedProviderState(
  receipt: FeexpayReceipt,
  expected: {
    reference: string;
    amountMinor: number;
    currency: "XOF";
    channelId: string;
    phoneNumber: string;
  },
): LinkFlowPublicState {
  if (receipt.reference !== expected.reference) return "uncertain";
  if (receipt.status === "PENDING") return "waiting";
  const channel = feexpayChannels.find((candidate) => candidate.id === expected.channelId);
  const country = channel && feexpayCountries.find((candidate) =>
    candidate.countryCode === channel.countryCode);
  const expectedPhone = expected.phoneNumber.replace(/\D/g, "");
  if (receipt.verifiedStatusOperation !== "payin" ||
    !channel || country?.currency !== expected.currency ||
    receipt.phoneNumber !== expectedPhone) return "uncertain";
  // FeexPay's documented v2 status response omits currency. Do not synthesize
  // a provider currency; bind an absent value only to the XOF channel and
  // currency that SendFlow used to create this exact attempt.
  if (receipt.amountMinor !== expected.amountMinor ||
    (receipt.currency !== undefined && receipt.currency !== expected.currency)) {
    return "uncertain";
  }
  if (receipt.status === "SUCCESSFUL") return "succeeded";
  if (receipt.status === "FAILED") return "failed";
  return "uncertain";
}
