import app from "./app";
import { logger } from "./lib/logger";
import { getPleskPort, listenOnPleskPort } from "./lib/plesk-listener";
import {
  getMissingApiEnvironmentNames,
  startEmbeddedApiRuntime,
} from "./embedded-runtime";

const port = getPleskPort(process.env["PORT"]);

async function startServer(): Promise<void> {
  const server = listenOnPleskPort(app, port);
  server.on("error", (err) => {
    logger.fatal({ err }, "Plesk API listener failed");
    process.exit(1);
  });
  server.once("listening", () => {
    startEmbeddedApiRuntime();
    logger.info(
      {
        host: "0.0.0.0",
        port,
        portSource: "environment",
        apiMount: { path: "/api", status: "active" },
        missingRuntimeEnvironmentNames: getMissingApiEnvironmentNames(),
      },
      "Plesk API application listening",
    );
  });
}

startServer().catch((err: unknown) => {
  logger.fatal({ err }, "Plesk API startup failed");
  process.exit(1);
});
