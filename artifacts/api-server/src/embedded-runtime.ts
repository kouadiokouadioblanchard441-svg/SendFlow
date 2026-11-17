import type { IncomingMessage, ServerResponse } from "node:http";
import { pool } from "@workspace/db";
import app from "./app";
import { classifyDatabaseFailure } from "./lib/database-failure";
import { logger } from "./lib/logger";
import { startDeveloperWebhookWorker } from "./services/developer-webhook-worker";
import { startEmailCampaignWorker } from "./services/email-campaign-worker";
import { startIdentityVerificationUploadCleanup } from "./services/identity-verification-upload-cleanup";

let runtimeStarted = false;

export function getMissingApiEnvironmentNames(): string[] {
  return [
    ...(!process.env.NODE_ENV?.trim() ? ["NODE_ENV"] : []),
    ...(!process.env.SENDFLOW_DATABASE_TARGET?.trim()
      ? ["SENDFLOW_DATABASE_TARGET"]
      : []),
    ...(!process.env.TRUST_PROXY_HOPS?.trim() ? ["TRUST_PROXY_HOPS"] : []),
    ...(!process.env.CORS_ALLOWED_ORIGINS?.trim()
      ? ["CORS_ALLOWED_ORIGINS"]
      : []),
    ...(!process.env.SUPABASE_DATABASE_URL?.trim() &&
    !process.env.DATABASE_URL?.trim()
      ? ["SUPABASE_DATABASE_URL or DATABASE_URL"]
      : []),
    ...(!process.env.DATABASE_CA_CERT?.trim() ? ["DATABASE_CA_CERT"] : []),
    ...(!process.env.TURNSTILE_SITE_KEY?.trim() ? ["TURNSTILE_SITE_KEY"] : []),
    ...(!process.env.TURNSTILE_SECRET_KEY?.trim()
      ? ["TURNSTILE_SECRET_KEY"]
      : []),
    ...(!process.env.SESSION_SECRET?.trim() ? ["SESSION_SECRET"] : []),
    ...(!process.env.CUSTOMER_PII_ENCRYPTION_KEY?.trim()
      ? ["CUSTOMER_PII_ENCRYPTION_KEY"]
      : []),
    ...(!process.env.ADMIN_SECRET_PATH?.trim() ? ["ADMIN_SECRET_PATH"] : []),
    ...(!process.env.ADMIN_SECRET_TOKEN?.trim() ? ["ADMIN_SECRET_TOKEN"] : []),
    ...(!process.env.SENDFLOW_ADMIN_JWT_PRIVATE_KEY?.trim()
      ? ["SENDFLOW_ADMIN_JWT_PRIVATE_KEY"]
      : []),
    ...(!process.env.SENDFLOW_ADMIN_JWT_PUBLIC_KEY?.trim()
      ? ["SENDFLOW_ADMIN_JWT_PUBLIC_KEY"]
      : []),
    ...(!process.env.SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY?.trim()
      ? ["SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY"]
      : []),
  ];
}

export function startEmbeddedApiRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;

  pool.on("error", (error: unknown) => {
    logger.error(
      {
        dependency: "database",
        failureCategory: classifyDatabaseFailure(error),
      },
      "Database idle connection failed",
    );
  });

  void pool
    .query("SELECT 1")
    .then(() => {
      logger.info(
        { dependency: "database", status: "connected" },
        "Startup database connectivity check succeeded",
      );
    })
    .catch((error: unknown) => {
      logger.error(
        {
          dependency: "database",
          failureCategory: classifyDatabaseFailure(error),
        },
        "Startup database connectivity check failed",
      );
    });

  if (process.env.NODE_ENV === "production") {
    for (const [name, start] of [
      ["developer_webhook", startDeveloperWebhookWorker],
      ["email_campaign", startEmailCampaignWorker],
      ["identity_upload_cleanup", startIdentityVerificationUploadCleanup],
    ] as const) {
      try {
        start(logger);
      } catch {
        logger.error(
          { component: name, failureCategory: "worker_start_failed" },
          "Background worker could not start",
        );
      }
    }
  }
}

export function logPleskApplicationStarted(port: number): void {
  logger.info(
    {
      host: "0.0.0.0",
      port,
      apiMount: { path: "/api", status: "active" },
      missingRuntimeEnvironmentNames: getMissingApiEnvironmentNames(),
      databaseConnectionCheck: "started",
    },
    "Plesk application started with integrated API",
  );
}

export function handleEmbeddedApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const failSafely = (error?: unknown) => {
    if (error) {
      logger.error(
        {
          dependency: "api",
          failureCategory: "api_dispatch_failed",
        },
        "API request dispatch failed",
      );
    }
    if (response.headersSent) {
      response.end();
      return;
    }
    response.statusCode = 503;
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({
      code: "API_DISPATCH_UNAVAILABLE",
      error: "Le service est momentanément indisponible.",
    }));
  };
  try {
    const expressApp = app as unknown as {
      handle: (
        request: IncomingMessage,
        response: ServerResponse,
        callback?: (error?: unknown) => void,
      ) => void;
    };
    expressApp.handle(request, response, failSafely);
  } catch {
    failSafely(new Error("API dispatch failed"));
  }
}

