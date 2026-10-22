import { createHmac, timingSafeEqual } from "node:crypto";
import { assertExternalProviderCallsAllowed } from "./provider-call-policy.ts";

const DIDIT_API_BASE_URL = "https://verification.didit.me/v3";

export const DIDIT_STATUSES = [
  "Not Started",
  "In Progress",
  "Awaiting User",
  "In Review",
  "Approved",
  "Declined",
  "Resubmitted",
  "Expired",
  "Kyc Expired",
  "Abandoned",
] as const;

export type DiditStatus = (typeof DIDIT_STATUSES)[number];

export class DiditConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiditConfigurationError";
  }
}

function getRequiredConfig() {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim();
  const environment = process.env.DIDIT_ENVIRONMENT?.trim().toLowerCase();

  const expectedEnvironment =
    process.env.NODE_ENV === "production" ? "live" : "sandbox";

  if (!apiKey || !workflowId || environment !== expectedEnvironment) {
    throw new DiditConfigurationError(
      "Didit environment is not configured safely",
    );
  }

  return { apiKey, workflowId, environment };
}

export function assertDiditConfiguration(): void {
  assertExternalProviderCallsAllowed("Didit");
  getRequiredConfig();
}

function diditUrl(path: string) {
  return `${DIDIT_API_BASE_URL}${path}`;
}

async function diditRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  assertExternalProviderCallsAllowed("Didit");
  const { apiKey } = getRequiredConfig();
  const response = await fetch(diditUrl(path), {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...init.headers,
    },
  });

  const body = await response.text();
  let parsed: unknown = null;
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
  }

  if (!response.ok) {
    throw new Error(`Didit API request failed with status ${response.status}`);
  }

  return parsed as T;
}

function isSafeDiditVerificationUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "verify.didit.me" &&
      url.pathname.startsWith("/session/")
    );
  } catch {
    return false;
  }
}

function getSafeCallbackUrl() {
  const callback = process.env.DIDIT_CALLBACK_URL?.trim();
  if (!callback) return undefined;

  let url: URL;
  try {
    url = new URL(callback);
  } catch {
    throw new DiditConfigurationError("DIDIT_CALLBACK_URL is invalid");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new DiditConfigurationError("DIDIT_CALLBACK_URL must use HTTPS");
  }

  return url.toString();
}

export type CreateDiditSessionInput = {
  vendorData: string;
  sandboxScenario?: string;
  callback?: string;
};

export type CreateDiditSessionResponse = {
  session_id: string;
  session_token?: string;
  url: string;
  status: string;
  vendor_data?: string;
  workflow_id: string;
};

export async function createDiditSession(
  input: CreateDiditSessionInput,
): Promise<CreateDiditSessionResponse> {
  assertExternalProviderCallsAllowed("Didit");
  const { workflowId, environment } = getRequiredConfig();
  const payload: Record<string, unknown> = {
    workflow_id: workflowId,
    vendor_data: input.vendorData,
    callback_method: "both",
    language: "fr",
  };

  if (input.callback) payload.callback = input.callback;
  if (environment === "sandbox" && input.sandboxScenario) {
    payload.sandbox_scenario = input.sandboxScenario;
  }

  const response = await diditRequest<unknown>("/session/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (
    !response ||
    typeof response !== "object" ||
    typeof (response as Record<string, unknown>).session_id !== "string" ||
    typeof (response as Record<string, unknown>).url !== "string" ||
    typeof (response as Record<string, unknown>).status !== "string" ||
    typeof (response as Record<string, unknown>).workflow_id !== "string"
  ) {
    throw new Error("Didit returned an invalid session response");
  }

  const session = response as CreateDiditSessionResponse;
  if (!isDiditStatus(session.status) || !isSafeDiditVerificationUrl(session.url)) {
    throw new Error("Didit returned an unsafe session response");
  }

  return session;
}

function sortForSignature(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForSignature);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, sortForSignature(nested)]),
    );
  }
  return value;
}

export function isValidDiditSignature(
  payload: unknown,
  signature: string | undefined,
): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const actual = signature.trim().toLowerCase();
  // Validate before converting: a 64-character non-ASCII string can occupy
  // more than 64 bytes and otherwise make timingSafeEqual throw.
  if (!/^[a-f0-9]{64}$/.test(actual)) return false;
  const expected = createHmac("sha256", secret)
    .update(JSON.stringify(sortForSignature(payload)))
    .digest();

  return timingSafeEqual(Buffer.from(actual, "hex"), expected);
}

export function isFreshDiditTimestamp(
  timestamp: string | undefined,
  now = Date.now(),
) {
  if (!timestamp || !/^\d+$/.test(timestamp.trim())) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  return Math.abs(Math.floor(now / 1000) - timestampSeconds) <= 300;
}

export function isFreshSignedDiditTimestamp(
  payload: unknown,
  timestamp: string | undefined,
  now = Date.now(),
): boolean {
  if (!isFreshDiditTimestamp(timestamp, now)) return false;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  // V2 authenticates the body, not HTTP headers. A captured signature must not
  // become fresh again merely by replacing an unsigned X-Timestamp header.
  try {
    const signedTimestamp = Object.getOwnPropertyDescriptor(payload, "timestamp")?.value;
    return Number.isSafeInteger(signedTimestamp)
      && signedTimestamp > 0
      && signedTimestamp === Number(timestamp);
  } catch {
    return false;
  }
}

export function isDiditStatus(value: string): value is DiditStatus {
  return DIDIT_STATUSES.includes(value as DiditStatus);
}

export function isSandboxEnvironment() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DIDIT_ENVIRONMENT?.trim().toLowerCase() === "sandbox"
  );
}

export { getSafeCallbackUrl };