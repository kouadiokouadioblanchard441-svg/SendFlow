import app from "./app";
import { logger } from "./lib/logger";
import { startDeveloperWebhookWorker } from "./services/developer-webhook-worker";
import { startEmailCampaignWorker } from "./services/email-campaign-worker";
import { startIdentityVerificationUploadCleanup } from "./services/identity-verification-upload-cleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    if (process.env.NODE_ENV === "production") {
      startDeveloperWebhookWorker(logger);
      startEmailCampaignWorker(logger);
      startIdentityVerificationUploadCleanup(logger);
    }
  });
}

startServer().catch((err: unknown) => {
  logger.error({ err }, "API server startup failed");
  process.exit(1);
});
