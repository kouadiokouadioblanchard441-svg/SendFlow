import { assertExternalProviderCallsAllowed } from "./provider-call-policy.ts";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export class ResendConfigurationError extends Error {
  constructor() {
    super("Transactional email delivery is not configured");
    this.name = "ResendConfigurationError";
  }
}

export class ResendDeliveryError extends Error {
  readonly statusCode: number | null;

  constructor(statusCode: number | null) {
    super("Transactional email delivery failed");
    this.name = "ResendDeliveryError";
    this.statusCode = statusCode;
  }
}

export type ResendMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type ResendResponse = {
  id?: unknown;
};

type SendResendEmailOptions = {
  apiKey?: string;
  fromEmail?: string;
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
};

export function isResendEmailConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}

export async function sendResendEmail(
  message: ResendMessage,
  options: SendResendEmailOptions = {},
): Promise<{ messageId: string; statusCode: number }> {
  assertExternalProviderCallsAllowed("Resend");

  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const fromEmail = options.fromEmail ?? process.env.RESEND_FROM_EMAIL;
  if (!apiKey?.trim() || !fromEmail?.trim()) {
    throw new ResendConfigurationError();
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey?.trim()
          ? { "Idempotency-Key": options.idempotencyKey.trim() }
          : {}),
      },
      body: JSON.stringify({
        from: fromEmail.trim(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    throw new ResendDeliveryError(null);
  }

  if (!response.ok) {
    throw new ResendDeliveryError(response.status);
  }

  let body: ResendResponse;
  try {
    body = await response.json() as ResendResponse;
  } catch {
    throw new ResendDeliveryError(response.status);
  }
  if (typeof body.id !== "string" || !body.id) {
    throw new ResendDeliveryError(response.status);
  }

  return { messageId: body.id, statusCode: response.status };
}
