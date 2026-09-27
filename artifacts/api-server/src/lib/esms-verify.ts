const ESMS_VERIFY_BASE_URL = "https://sms.esmsafrica.io/api";
const ESMS_REQUEST_TIMEOUT_MS = 10_000;

type JsonRecord = Record<string, unknown>;

export class EsmsConfigurationError extends Error {
  constructor(message = "eSMS Verify credentials are not configured") {
    super(message);
    this.name = "EsmsConfigurationError";
  }
}

export class EsmsProviderError extends Error {
  readonly statusCode?: number;
  readonly providerMessage?: string;

  constructor(
    message: string,
    statusCode?: number,
    providerMessage?: string,
  ) {
    super(message);
    this.name = "EsmsProviderError";
    this.statusCode = statusCode;
    this.providerMessage = providerMessage;
  }
}

export class EsmsRateLimitError extends EsmsProviderError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds = 60) {
    super("eSMS Verify rate limit reached", 429);
    this.name = "EsmsRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type EsmsVerifyClient = ReturnType<typeof createEsmsVerifyClient>;

type EsmsVerifyOptions = {
  apiKey: string | undefined;
  appId: string | undefined;
  fetchImpl?: typeof fetch;
};

function parseRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function sanitizeProviderMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const sanitized = value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/esms_(?:test|live)_[A-Za-z0-9._~-]+/gi, "[redacted credential]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted number]")
    .replace(/\b\d{6}\b/g, "[redacted code]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  return sanitized || undefined;
}

function getProviderMessage(payload: JsonRecord): string | undefined {
  const nestedError = parseRecord(payload.error);
  const candidates = [
    payload.message,
    payload.error_description,
    payload.detail,
    nestedError?.message,
    nestedError?.detail,
    payload.error,
  ];

  for (const candidate of candidates) {
    const message = sanitizeProviderMessage(candidate);
    if (message) return message;
  }

  return undefined;
}

async function parseResponse(response: Response): Promise<JsonRecord> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new EsmsProviderError("eSMS Verify returned an invalid response", response.status);
  }

  const record = parseRecord(payload);
  if (!record) {
    throw new EsmsProviderError("eSMS Verify returned an invalid response", response.status);
  }

  return record;
}

export function createEsmsVerifyClient({
  apiKey,
  appId,
  fetchImpl = fetch,
}: EsmsVerifyOptions) {
  const normalizedApiKey = apiKey?.trim();
  const normalizedAppId = appId?.trim();

  if (
    !normalizedApiKey
    || !/^esms_(test|live)_.+$/.test(normalizedApiKey)
    || !normalizedAppId
    || normalizedAppId.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalizedAppId)
  ) {
    throw new EsmsConfigurationError();
  }

  async function post(path: string, body: JsonRecord): Promise<{ response: Response; payload: JsonRecord }> {
    let response: Response;
    try {
      response = await fetchImpl(`${ESMS_VERIFY_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${normalizedApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ESMS_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new EsmsProviderError("Could not connect to eSMS Verify");
    }

    if (response.status === 429) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? Math.min(3600, Math.ceil(retryAfterHeader))
        : 60;
      throw new EsmsRateLimitError(retryAfterSeconds);
    }

    const payload = await parseResponse(response);
    return { response, payload };
  }

  return {
    async start(to: string): Promise<{ verificationId: string }> {
      const { response, payload } = await post("/verify/start", {
        to,
        app_id: normalizedAppId,
      });

      if (!response.ok) {
        throw new EsmsProviderError(
          "eSMS Verify could not start the verification",
          response.status,
          getProviderMessage(payload),
        );
      }

      const verificationId = payload.verification_id;
      const status = typeof payload.status === "string" ? payload.status.toLowerCase() : "";
      if (typeof verificationId !== "string" || !verificationId || status !== "pending") {
        throw new EsmsProviderError("eSMS Verify returned an unexpected start response", response.status);
      }

      return { verificationId };
    },

    async check(verificationId: string, code: string): Promise<{ approved: boolean }> {
      const { response, payload } = await post("/verify/check", {
        verification_id: verificationId,
        code,
      });

      if (!response.ok) {
        if ([400, 409, 422].includes(response.status)) return { approved: false };
        throw new EsmsProviderError(
          "eSMS Verify could not check the code",
          response.status,
          getProviderMessage(payload),
        );
      }

      const status = payload.status;
      if (typeof status !== "string") {
        throw new EsmsProviderError("eSMS Verify returned an unexpected check response", response.status);
      }

      return { approved: status.toLowerCase() === "approved" };
    },
  };
}

export function getEsmsVerifyClient() {
  return createEsmsVerifyClient({
    apiKey: process.env.ESMS_API_KEY,
    appId: process.env.ESMS_VERIFY_APP_ID,
  });
}