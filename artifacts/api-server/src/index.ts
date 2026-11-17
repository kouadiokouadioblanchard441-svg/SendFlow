import app from "./app";
import { logger } from "./lib/logger";
import { getPleskPort, listenOnPleskPort } from "./lib/plesk-listener";
import { startDeveloperWebhookWorker } from "./services/developer-webhook-worker";
import { startEmailCampaignWorker } from "./services/email-campaign-worker";
import { startIdentityVerificationUploadCleanup } from "./services/identity-verification-upload-cleanup";

const port = getPleskPort(process.env["PORT"]);

async function startServer(): Promise<void> {
  const server = listenOnPleskPort(app, port);
  server.on("error", (err) => {
    logger.fatal({ err }, "Plesk API listener failed");
    process.exit(1);
  });
  server.once("listening", () => {
    logger.info({ host: "0.0.0.0", port }, "Plesk API server listening");
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
