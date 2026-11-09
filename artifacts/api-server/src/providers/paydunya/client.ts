import { createHash, timingSafeEqual } from "node:crypto";

type Environment = Readonly<Record<string, string | undefined>>;
type Transport = typeof fetch;

export type PaydunyaInvoiceStatus = "pending" | "completed" | "failed";
export type PaydunyaClientErrorCode =
  | "CONFIGURATION_REQUIRED"
  | "LIVE_DISABLED"
  | "INVALID_INPUT"
  | "PROVIDER_UNAVAILABLE"
  | "OUTCOME_UNKNOWN"
  | "INVALID_RESPONSE"
  | "UNVERIFIED_STATUS";

export class PaydunyaError extends Error {
  readonly code: PaydunyaClientErrorCode;

  constructor(code: PaydunyaClientErrorCode) {
    super(`PayDunya: ${code}`);
    this.name = "PaydunyaError";
    this.code = code;
  }
}

export type PaydunyaInvoice = {
  token: string;
  redirectUrl: string;
};

export type PaydunyaVerifiedStatus = {
  token: string;
  status: PaydunyaInvoiceStatus;
  amountMinor: number;
  currency: "XOF";
  sendflowReference: string;
  phoneNumber: string | null;
};

const maxResponseBytes = 64 * 1024;
const tokenPattern = /^[A-Za-z0-9_-]{6,120}$/;
const channelPattern = /^[a-z0-9-]{2,80}$/;
const referencePattern = /^[A-Z0-9]{12,30}$/;

function fail(code: PaydunyaClientErrorCode): never {
  throw new PaydunyaError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseMinorAmount(value: unknown): number | null {
  if (!(typeof value === "number" || (typeof value === "string" && /^[0-9]+$/.test(value)))) {
    return null;
  }
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return fail("INVALID_RESPONSE");
  return value;
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return fail("INVALID_RESPONSE");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxResponseBytes) {
        await reader.cancel();
        return fail("INVALID_RESPONSE");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return fail("INVALID_RESPONSE");
  } finally {
    reader.releaseLock();
  }
}

export function isPaydunyaLiveExecutionAllowed(environment: Environment): boolean {
  if (environment.PAYDUNYA_LIVE_ENABLED !== "true") return false;
  if (environment.PAYDUNYA_EXECUTION_HOST === "plesk") {
    return environment.NODE_ENV === "production"
      && environment.SENDFLOW_DATABASE_TARGET === "production"
      && !environment.REPL_ID
      && !environment.REPLIT_DEV_DOMAIN;
  }
  return environment.PAYDUNYA_EXECUTION_HOST === "replit"
    && environment.SENDFLOW_DATABASE_TARGET === "shared-external"
    && environment.SENDFLOW_REPLIT_LIVE_APPROVED === "true"
    && environment.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED === "true";
}

function verifyMasterKeyHash(hash: unknown, masterKey: string): boolean {
  if (typeof hash !== "string" || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const expected = Buffer.from(createHash("sha512").update(masterKey, "utf8").digest("hex"), "hex");
  const received = Buffer.from(hash, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export class PaydunyaClient {
  #environment: Environment;
  #transport: Transport;

  constructor(environment: Environment = process.env, transport: Transport = fetch) {
    this.#environment = { ...environment };
    this.#transport = transport;
  }

  private configuration() {
    const env = this.#environment;
    if (!isPaydunyaLiveExecutionAllowed(env)) return fail("LIVE_DISABLED");
    const masterKey = env.PAYDUNYA_MASTER_KEY;
    const privateKey = env.PAYDUNYA_PRIVATE_KEY;
    const token = env.PAYDUNYA_TOKEN;
    if (!masterKey || !privateKey || !token ||
      /[\r\n]/.test(masterKey) || /[\r\n]/.test(privateKey) || /[\r\n]/.test(token)) {
      return fail("CONFIGURATION_REQUIRED");
    }
    return {
      masterKey,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "PAYDUNYA-MASTER-KEY": masterKey,
        "PAYDUNYA-PRIVATE-KEY": privateKey,
        "PAYDUNYA-TOKEN": token,
      },
      origin: "https://app.paydunya.com/api/v1",
    };
  }

  private async request(path: string, method: "GET" | "POST", body?: Record<string, unknown>) {
    const config = this.configuration();
    try {
      const response = await this.#transport(`${config.origin}${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: config.headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return fail(method === "POST" ? "OUTCOME_UNKNOWN" : "PROVIDER_UNAVAILABLE");
      }
      return await boundedJson(response);
    } catch (error) {
      if (error instanceof PaydunyaError) throw error;
      return fail(method === "POST" ? "OUTCOME_UNKNOWN" : "PROVIDER_UNAVAILABLE");
    }
  }

  async createInvoice(input: {
    amountMinor: number;
    operationReference: string;
    channel: string;
    phoneNumber: string;
    customerName?: string;
  }): Promise<PaydunyaInvoice> {
    this.configuration();
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 100 ||
      input.amountMinor > 2_000_000 || !referencePattern.test(input.operationReference) ||
      !channelPattern.test(input.channel) || !/^[0-9]{8,15}$/.test(input.phoneNumber) ||
      (input.customerName !== undefined &&
        (!input.customerName.trim() || input.customerName.trim().length > 120))) {
      return fail("INVALID_INPUT");
    }

    const raw = await this.request("/checkout-invoice/create", "POST", {
      invoice: {
        total_amount: input.amountMinor,
        description: `Paiement SendFlow ${input.operationReference}`,
        channels: [input.channel],
        customer: {
          phone: input.phoneNumber,
          ...(input.customerName ? { name: input.customerName.trim() } : {}),
        },
      },
      store: { name: "SendFlow" },
      custom_data: { sendflow_reference: input.operationReference },
    });
    const result = readJsonObject(raw);
    if (result.response_code !== "00" || typeof result.token !== "string" ||
      !tokenPattern.test(result.token) || typeof result.response_text !== "string") {
      return fail("OUTCOME_UNKNOWN");
    }
    let redirect: URL;
    try {
      redirect = new URL(result.response_text);
    } catch {
      return fail("INVALID_RESPONSE");
    }
    if (redirect.protocol !== "https:" || redirect.hostname !== "app.paydunya.com" ||
      redirect.username || redirect.password ||
      !/^\/checkout\/invoice\/[A-Za-z0-9_-]{6,120}$/.test(redirect.pathname)) {
      return fail("INVALID_RESPONSE");
    }
    return { token: result.token, redirectUrl: redirect.toString() };
  }

  async getVerifiedInvoiceStatus(input: {
    token: string;
    expectedAmountMinor: number;
    expectedReference: string;
    expectedPhoneNumber: string;
  }): Promise<PaydunyaVerifiedStatus> {
    const config = this.configuration();
    if (!tokenPattern.test(input.token) ||
      !Number.isSafeInteger(input.expectedAmountMinor) || input.expectedAmountMinor <= 0 ||
      !referencePattern.test(input.expectedReference) ||
      !/^[0-9]{8,15}$/.test(input.expectedPhoneNumber)) {
      return fail("INVALID_INPUT");
    }
    const raw = await this.request(
      `/checkout-invoice/confirm/${encodeURIComponent(input.token)}`,
      "GET",
    );
    const result = readJsonObject(raw);
    const invoice = readJsonObject(result.invoice);
    const customData = isRecord(result.custom_data) ? result.custom_data : null;
    const amountMinor = parseMinorAmount(invoice.total_amount);
    const status = typeof result.status === "string" ? result.status.toLowerCase() : "";
    const customer = isRecord(result.customer) ? result.customer : null;
    const phoneNumber = typeof customer?.phone === "string"
      ? customer.phone.replace(/\D/g, "")
      : null;
    const responseCodeMatches = result.response_code === "00";
    const tokenMatches = invoice.token === input.token;
    const amountMatches = amountMinor === input.expectedAmountMinor;
    const referenceMatches = customData?.sendflow_reference === input.expectedReference;
    const phoneMatches = phoneNumber === input.expectedPhoneNumber;
    const hashMatches = verifyMasterKeyHash(result.hash, config.masterKey);
    if (!responseCodeMatches || !tokenMatches || !amountMatches ||
      !referenceMatches || !phoneMatches || !hashMatches) {
      return fail("UNVERIFIED_STATUS");
    }
    if (status !== "pending" && status !== "completed" &&
      status !== "failed" && status !== "cancelled") {
      return fail("INVALID_RESPONSE");
    }
    return {
      token: input.token,
      status: status === "cancelled" ? "failed" : status,
      amountMinor,
      currency: "XOF",
      sendflowReference: input.expectedReference,
      phoneNumber,
    };
  }
}
