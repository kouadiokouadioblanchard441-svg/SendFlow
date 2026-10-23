import { feexpayChannels, feexpayCountries } from "./catalog.ts";
import { isFeexpayLiveExecutionAllowed } from "./live-runtime.ts";

type Environment = Record<string, string | undefined>;
type Transport = typeof fetch;
type Operation = "payin" | "payout";
export type FeexpayStatus = "PENDING" | "SUCCESSFUL" | "FAILED";
export type FeexpayErrorCode = "CONFIGURATION_REQUIRED" | "LIVE_DISABLED" | "INVALID_INPUT" |
  "CHANNEL_UNAVAILABLE" | "CURRENCY_UNAVAILABLE" | "OUTCOME_UNKNOWN" | "PROVIDER_UNAVAILABLE" | "INVALID_RESPONSE";

export class FeexpayError extends Error {
  readonly code: FeexpayErrorCode;
  constructor(code: FeexpayErrorCode) {
    super(`FeexPay: ${code}`);
    this.name = "FeexpayError";
    this.code = code;
  }
}

export interface FeexpayPaymentRequest {
  channelId: string;
  amountMinor: number;
  currency: "XOF";
  phoneNumber: string;
  /** Persist a unique server-generated operation reference BEFORE dispatch. */
  operationReference: string;
  otp?: string;
}

export interface FeexpayReceipt {
  reference: string;
  status: FeexpayStatus;
  amountMinor?: number;
  currency?: "XOF" | "XAF";
}

const referencePattern = /^[a-zA-Z0-9_-]{8,120}$/;
const maxResponseBytes = 64 * 1024;

function fail(code: FeexpayErrorCode): never { throw new FeexpayError(code); }

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return fail("INVALID_RESPONSE");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        return fail("INVALID_RESPONSE");
      }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } finally { reader.releaseLock(); }
}

function parseReceipt(raw: unknown, expectedReference?: string): FeexpayReceipt {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("INVALID_RESPONSE");
  const data = raw as Record<string, unknown>;
  if (typeof data.reference !== "string" || !referencePattern.test(data.reference) ||
      (expectedReference !== undefined && expectedReference !== data.reference)) return fail("INVALID_RESPONSE");
  const status = data.status === "IN PENDING STATE" ? "PENDING" : data.status;
  if (status !== "PENDING" && status !== "SUCCESSFUL" && status !== "FAILED") return fail("INVALID_RESPONSE");
  const receipt: FeexpayReceipt = { reference: data.reference, status };
  if (data.amount !== undefined) {
    if (!(typeof data.amount === "number" || (typeof data.amount === "string" && /^[0-9]+$/.test(data.amount)))) return fail("INVALID_RESPONSE");
    const amount = Number(data.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return fail("INVALID_RESPONSE");
    receipt.amountMinor = amount;
  }
  if (data.currency !== undefined) {
    if (data.currency !== "XOF" && data.currency !== "XAF") return fail("INVALID_RESPONSE");
    receipt.currency = data.currency;
  }
  return receipt;
}

/**
 * Server-only protocol client, NOT a wallet/transfer execution service.
 * No automatic retries, ledger writes, redirects or webhook-trusted settlement.
 * A POST response (including SUCCESSFUL) must be independently reconciled.
 */
export class FeexpayClient {
  #environment: Environment;
  #transport: Transport;

  constructor(environment: Environment = process.env, transport: Transport = fetch) {
    this.#environment = { ...environment };
    this.#transport = transport;
  }

  private configuration() {
    const env = this.#environment;
    const mode = env.FEEXPAY_MODE;
    if (mode !== "live" && mode !== "sandbox") return fail("CONFIGURATION_REQUIRED");
    if (mode === "live" && !isFeexpayLiveExecutionAllowed(env)) return fail("LIVE_DISABLED");
    // Never reuse a live key or shop implicitly in sandbox.
    const key = mode === "sandbox" ? env.FEEXPAY_SANDBOX_API_KEY : env.FEEXPAY_API_KEY;
    const shop = mode === "sandbox" ? env.FEEXPAY_SANDBOX_SHOP_ID : env.FEEXPAY_SHOP_ID;
    if (!key || !shop || /[\r\n]/.test(key) || !/^[a-zA-Z0-9_-]{3,120}$/.test(shop) ||
      (mode === "sandbox" && !key.startsWith("test_key_"))) return fail("CONFIGURATION_REQUIRED");
    return { mode, key, shop, origin: mode === "sandbox" ? "https://sandbox-api.feexpay.me" : "https://api-v2.feexpay.me" };
  }

  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const config = this.configuration();
    try {
      const response = await this.#transport(`${config.origin}${path}`, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${config.key}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return fail(body ? "OUTCOME_UNKNOWN" : "PROVIDER_UNAVAILABLE");
      }
      return await boundedJson(response);
    } catch {
      // No provider response, URL, phone, OTP, credential or underlying cause leaks.
      return fail(body ? "OUTCOME_UNKNOWN" : "PROVIDER_UNAVAILABLE");
    }
  }

  async initiate(operation: Operation, input: FeexpayPaymentRequest): Promise<FeexpayReceipt> {
    const config = this.configuration();
    if (operation !== "payin" && operation !== "payout") return fail("INVALID_INPUT");
    // Direct REST only. Never silently revive legacy checkout/redirect options.
    if ("returnUrl" in input || "cancelUrl" in input) return fail("INVALID_INPUT");
    const channel = feexpayChannels.find((candidate) => candidate.id === input.channelId);
    if (!channel || (config.mode === "sandbox" && !channel.sandbox) ||
      (operation === "payout" && !channel.payoutPath)) return fail("CHANNEL_UNAVAILABLE");
    const country = feexpayCountries.find((candidate) => candidate.countryCode === channel.countryCode)!;
    if (input.currency !== "XOF" || country.currency !== input.currency) return fail("CURRENCY_UNAVAILABLE");
    // Conservative SendFlow protocol envelope; per-channel commercial limits still need verification.
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 100 || input.amountMinor > 2_000_000 ||
      typeof input.phoneNumber !== "string" || !/^[0-9]{8,15}$/.test(input.phoneNumber) ||
      !input.phoneNumber.startsWith(country.phonePrefix) ||
      typeof input.operationReference !== "string" || !/^[A-Z0-9]{12,30}$/.test(input.operationReference)) return fail("INVALID_INPUT");
    if (operation === "payin" && channel.requiresOtp && !input.otp) return fail("INVALID_INPUT");
    if (input.otp !== undefined && !/^[0-9]{4,12}$/.test(input.otp)) return fail("INVALID_INPUT");
    const body: Record<string, unknown> = {
      shop: config.shop, amount: input.amountMinor, phoneNumber: input.phoneNumber,
      callback_info: input.operationReference,
      ...(operation === "payin" ? {
        description: input.operationReference,
        ...(input.otp ? { otp: input.otp } : {}),
      } : {
        motif: input.operationReference,
        ...(channel.payoutNetwork ? { network: channel.payoutNetwork } : {}),
      }),
    };
    const raw = await this.request(operation === "payin" ? channel.payinPath : channel.payoutPath!, body);
    try {
      const receipt = parseReceipt(raw);
      if ((receipt.amountMinor !== undefined && receipt.amountMinor !== input.amountMinor) ||
          (receipt.currency !== undefined && receipt.currency !== input.currency)) return fail("INVALID_RESPONSE");
      return receipt;
    } catch { return fail("OUTCOME_UNKNOWN"); }
  }

  async getStatus(operation: Operation, reference: string): Promise<FeexpayReceipt> {
    if ((operation !== "payin" && operation !== "payout") ||
      typeof reference !== "string" || !referencePattern.test(reference)) return fail("INVALID_INPUT");
    const prefix = operation === "payin" ? "/api/transactions/public/single/status/" : "/api/payouts/status/public/";
    return parseReceipt(await this.request(`${prefix}${encodeURIComponent(reference)}`), reference);
  }
}
