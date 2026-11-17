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
    startDeveloperWebhookWorker(logger);
    startEmailCampaignWorker(logger);
    startIdentityVerificationUploadCleanup(logger);
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
  app.handle(request as never, response as never, (error?: unknown) => {
    if (error) {
      logger.error(
        {
          dependency: "api",
          failureCategory: "api_dispatch_failed",
        },
        "API request dispatch failed",
      );
    }
    if (!response.headersSent) {
      response.statusCode = 503;
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({
        code: "API_DISPATCH_UNAVAILABLE",
        error: "Le service est momentanément indisponible.",
      }));
      return;
    }
    response.end();
  });
}

