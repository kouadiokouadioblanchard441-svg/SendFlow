import app from "./app";
import { logger } from "./lib/logger";
import { getPleskPort, listenOnPleskPort } from "./lib/plesk-listener";
import { classifyDatabaseFailure } from "./lib/database-failure";
import { pool } from "@workspace/db";
import { startDeveloperWebhookWorker } from "./services/developer-webhook-worker";
import { startEmailCampaignWorker } from "./services/email-campaign-worker";
import { startIdentityVerificationUploadCleanup } from "./services/identity-verification-upload-cleanup";

const port = getPleskPort(process.env["PORT"]);
const missingRuntimeEnvironmentNames = [
  ...(!process.env.SENDFLOW_DATABASE_TARGET?.trim() ? ["SENDFLOW_DATABASE_TARGET"] : []),
  ...(!process.env.TRUST_PROXY_HOPS?.trim() ? ["TRUST_PROXY_HOPS"] : []),
  ...(!process.env.CORS_ALLOWED_ORIGINS?.trim() ? ["CORS_ALLOWED_ORIGINS"] : []),
  ...(!process.env.SUPABASE_DATABASE_URL?.trim() && !process.env.DATABASE_URL?.trim()
    ? ["SUPABASE_DATABASE_URL or DATABASE_URL"]
    : []),
  ...(!process.env.DATABASE_CA_CERT?.trim() ? ["DATABASE_CA_CERT"] : []),
  ...(!process.env.TURNSTILE_SITE_KEY?.trim() ? ["TURNSTILE_SITE_KEY"] : []),
  ...(!process.env.TURNSTILE_SECRET_KEY?.trim() ? ["TURNSTILE_SECRET_KEY"] : []),
];

pool.on("error", (error: unknown) => {
  logger.error(
    {
      dependency: "database",
      failureCategory: classifyDatabaseFailure(error),
    },
    "Database idle connection failed",
  );
});

async function startServer(): Promise<void> {
  const server = listenOnPleskPort(app, port);
  server.on("error", (err) => {
    logger.fatal({ err }, "Plesk API listener failed");
    process.exit(1);
  });
  server.once("listening", () => {
    logger.info(
      {
        host: "0.0.0.0",
        port,
        portSource: process.env.PORT?.trim() ? "environment" : "compatibility-fallback",
        missingRuntimeEnvironmentNames,
      },
      "Plesk API server listening",
    );
    if (process.env.NODE_ENV === "production") {
      startDeveloperWebhookWorker(logger);
      startEmailCampaignWorker(logger);
      startIdentityVerificationUploadCleanup(logger);
    }
  });
}

startServer().catch((err: unknown) => {
  logger.fatal({ err }, "Plesk API startup failed");
  process.exit(1);
});
