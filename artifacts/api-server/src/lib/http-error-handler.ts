import type { ErrorRequestHandler } from "express";
import { safeErrorForLog } from "./log-safety.ts";

const PUBLIC_BODY_ERRORS: Readonly<Record<string, { status: number; message: string }>> = {
  "entity.parse.failed": { status: 400, message: "Malformed request body" },
  "request.aborted": { status: 400, message: "Incomplete request body" },
  "request.size.invalid": { status: 400, message: "Invalid request body size" },
  "entity.too.large": { status: 413, message: "Request body too large" },
  "parameters.too.many": { status: 413, message: "Too many request parameters" },
  "charset.unsupported": { status: 415, message: "Unsupported request charset" },
  "encoding.unsupported": { status: 415, message: "Unsupported request encoding" },
};

function publicBodyError(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  try {
    if (error instanceof URIError) return { status: 400, message: "Malformed request path" };
    const type = Object.getOwnPropertyDescriptor(error, "type")?.value;
    return typeof type === "string" && Object.hasOwn(PUBLIC_BODY_ERRORS, type)
      ? PUBLIC_BODY_ERRORS[type] : undefined;
  } catch {
    return undefined;
  }
}

export const httpErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // Do not delegate to Express's default handler: it can print raw errors and
  // include stack traces or malformed input in development responses.
  req.log?.error({ failure: safeErrorForLog(error) }, "API request failed");
  if (res.headersSent) {
    if (!res.destroyed) res.destroy();
    return;
  }
  if (res.destroyed || res.writableEnded) return;
  const knownError = publicBodyError(error);
  res.setHeader("Cache-Control", "no-store, private");
  res.status(knownError?.status ?? 500).json({
    error: knownError?.message ?? "Internal server error",
  });
};
