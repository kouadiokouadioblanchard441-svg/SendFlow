import {
  resolveApiUrl,
  setUnsafeRequestPreparationHandler,
} from "@workspace/api-client-react";
import type { UnsafeRequestPreparation } from "@workspace/api-client-react";

type StepUpRequest = {
  action: string;
  query: Record<string, unknown>;
  payload: unknown;
};

type StepUpHandler = (request: StepUpRequest) => Promise<string>;

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const unauthenticatedPaths = new Set([
  "/sign-in",
  "/sign-out",
  "/refresh",
  "/activity",
  "/step-up",
  "/setup/start",
  "/setup/complete",
]);

let apiPathPrefix: string | null = null;
let stepUpHandler: StepUpHandler | null = null;

export function setAdminApiPathPrefix(prefix: string | null): void {
  apiPathPrefix = prefix
    ? new URL(prefix, "http://sendflow.internal").pathname.replace(/\/+$/u, "")
    : null;
  updatePreparationHandler();
}

export function setAdminStepUpHandler(handler: StepUpHandler | null): void {
  stepUpHandler = handler;
  updatePreparationHandler();
}

function updatePreparationHandler() {
  const prefix = apiPathPrefix;
  if (!prefix) {
    setUnsafeRequestPreparationHandler(null);
    return;
  }

  setUnsafeRequestPreparationHandler(async (request) => {
    const stepUp = await getStepUpRequest(request, prefix);
    if (!stepUp) return;
    if (!stepUpHandler) {
      throw new Error("La confirmation de cette action est indisponible.");
    }
    request.headers.set("x-admin-step-up", await stepUpHandler(stepUp));
  });
}

async function getStepUpRequest(
  request: UnsafeRequestPreparation,
  prefix: string,
): Promise<StepUpRequest | null> {
  if (!unsafeMethods.has(request.method)) return null;
  const inputUrl = request.input instanceof Request
    ? request.input.url
    : request.input.toString();
  const url = new URL(resolveApiUrl(inputUrl), "http://sendflow.internal");
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null;

  const actionPath = url.pathname.slice(prefix.length) || "/";
  if (unauthenticatedPaths.has(actionPath)) return null;

  const query: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    const existing = query[key];
    query[key] = existing === undefined
      ? value
      : Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
  }

  let payload: unknown = null;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    let rawBody = typeof request.init.body === "string" ? request.init.body : null;
    if (rawBody === null && request.input instanceof Request) {
      rawBody = await request.input.clone().text();
    }
    if (rawBody?.trim()) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new Error("Les paramètres de confirmation sont invalides.");
      }
    }
  }

  return {
    action: `${request.method}:${actionPath}`,
    query,
    payload,
  };
}
