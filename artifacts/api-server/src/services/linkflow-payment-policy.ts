import { createHash } from "node:crypto";
import { createSensitiveDataLookupIndex } from "../lib/sensitive-data-crypto.ts";
import { isFeexpayLiveExecutionAllowed } from "../providers/feexpay/live-runtime.ts";
import type { FeexpayReceipt } from "../providers/feexpay/client.ts";

export type LinkFlowPublicState = "waiting" | "uncertain" | "succeeded" | "failed";

type Environment = Record<string, string | undefined>;
// The reviewed public status response omits currency and does not bind the
// result to a verified shop/channel signature. Keep payment initiation closed
// until a documented authenticated settlement-evidence path is implemented.
const LINKFLOW_SETTLEMENT_PROOF_READY = false;

export function isLinkFlowPaymentExecutionEnabled(environment: Environment = process.env) {
  return environment.FEEXPAY_LINKFLOW_ENABLED === "true"
    && environment.FEEXPAY_MODE === "live"
    && environment.FEEXPAY_EXECUTION_HOST === "plesk"
    && environment.SENDFLOW_DATABASE_TARGET === "production"
    && Boolean(environment.FEEXPAY_API_KEY)
    && Boolean(environment.FEEXPAY_SHOP_ID)
    && LINKFLOW_SETTLEMENT_PROOF_READY
    && isFeexpayLiveExecutionAllowed(environment);
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
  expected: { reference: string; amountMinor: number; currency: "XOF"; shopId: string; channelId: string },
): LinkFlowPublicState {
  if (receipt.reference !== expected.reference) return "uncertain";
  if (receipt.status === "PENDING") return "waiting";
  if (receipt.merchantShopId !== expected.shopId ||
    receipt.channelId !== expected.channelId ||
    receipt.operation !== "payin" ||
    receipt.signatureVerified !== true) return "uncertain";
  if (receipt.amountMinor !== expected.amountMinor || receipt.currency !== expected.currency) {
    return "uncertain";
  }
  if (receipt.status === "SUCCESSFUL") return "succeeded";
  if (receipt.status === "FAILED") return "failed";
  return "uncertain";
}
