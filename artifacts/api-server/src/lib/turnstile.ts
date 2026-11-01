import { isIP } from "node:net";
import type { Request, Response as ExpressResponse } from "express";
import { getAllowedOrigins, normalizeHttpOrigin } from "./origin-policy.ts";

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_VERIFY_TIMEOUT_MS = 5_000;

export type TurnstileAction = "login" | "signup" | "password_reset";
export type TurnstileFailureCategory =
  | "missing_token"
  | "invalid_token"
  | "hostname_mismatch"
  | "action_mismatch"
  | "configuration_unavailable"
  | "siteverify_unavailable"
  | "invalid_siteverify_response";

export type TurnstileVerification =
  | { success: true }
  | { success: false; category: TurnstileFailureCategory; unavailable: boolean };

type TurnstileEnvironment = {
  TURNSTILE_SECRET_KEY?: string;
  NODE_ENV?: string;
  CORS_ALLOWED_ORIGINS?: string;
  REPLIT_DOMAINS?: string;
  REPLIT_DEV_DOMAIN?: string;
};

type TurnstileSiteverifyResponse = {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
};

type VerifyTurnstileOptions = {
  environment?: TurnstileEnvironment;
  fetcher?: typeof fetch;
  expectedHostname: string | undefined;
  remoteIp?: string;
  timeoutMs?: number;
};

function failure(
  category: TurnstileFailureCategory,
  unavailable = false,
): TurnstileVerification {
  return { success: false, category, unavailable };
}

export async function verifyTurnstileToken(
  token: unknown,
  expectedAction: TurnstileAction,
  options: VerifyTurnstileOptions,
): Promise<TurnstileVerification> {
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) {
    return failure("missing_token");
  }

  const environment = options.environment ?? process.env;
  const secret = environment.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return failure("configuration_unavailable", true);

  const origin = options.expectedHostname?.trim().toLowerCase();
  let expectedHostname: string | undefined;
  try {
    const expectedOrigins = getAllowedOrigins(environment);
    if (origin && expectedOrigins.has(`https://${origin}`)) {
      expectedHostname = origin;
    } else if (origin) {
      const matchingOrigin = [...expectedOrigins].find(
        (candidate) => new URL(candidate).hostname.toLowerCase() === origin,
      );
      if (matchingOrigin) expectedHostname = origin;
    }
  } catch {
    return failure("configuration_unavailable", true);
  }
  if (!expectedHostname) return failure("configuration_unavailable", true);

  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp && isIP(options.remoteIp)) {
    body.set("remoteip", options.remoteIp);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? TURNSTILE_VERIFY_TIMEOUT_MS,
  );
  timeout.unref?.();

  let result: TurnstileSiteverifyResponse;
  try {
    const response = await (options.fetcher ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!response.ok) return failure("siteverify_unavailable", true);
    try {
      result = await response.json() as TurnstileSiteverifyResponse;
    } catch {
      return failure(
        controller.signal.aborted ? "siteverify_unavailable" : "invalid_siteverify_response",
        true,
      );
    }
  } catch {
    return failure("siteverify_unavailable", true);
  } finally {
    clearTimeout(timeout);
  }
  if (typeof result !== "object" || result === null || result.success !== true) {
    return failure("invalid_token");
  }
  if (
    typeof result.hostname !== "string"
    || result.hostname.trim().toLowerCase() !== expectedHostname
  ) {
    return failure("hostname_mismatch");
  }
  if (
    typeof result.action !== "string"
    || result.action.trim() !== expectedAction
  ) {
    return failure("action_mismatch");
  }

  return { success: true };
}

export async function verifyTurnstileRequest(
  req: Request,
  token: unknown,
  expectedAction: TurnstileAction,
): Promise<TurnstileVerification> {
  const origin = normalizeHttpOrigin(req.get("origin"));
  const expectedHostname = origin ? new URL(origin).hostname : undefined;
  const remoteIp = typeof req.ip === "string" && isIP(req.ip) ? req.ip : undefined;
  return verifyTurnstileToken(token, expectedAction, {
    expectedHostname,
    remoteIp,
  });
}

export function rejectTurnstileRequest(
  req: Request,
  res: ExpressResponse,
  result: Exclude<TurnstileVerification, { success: true }>,
): void {
  req.log.warn(
    { category: result.category },
    "Turnstile verification rejected an authentication request",
  );
  res.setHeader("Cache-Control", "no-store, private");
  res.status(result.unavailable ? 503 : 403).json({
    error: result.unavailable
      ? "La vérification de sécurité est momentanément indisponible. Réessayez plus tard."
      : "La vérification de sécurité a échoué. Recommencez puis réessayez.",
  });
}

