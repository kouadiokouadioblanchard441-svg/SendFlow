import pino from "pino";
import { errorLogSerializers, sensitiveLogPaths } from "./log-safety";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: sensitiveLogPaths,
  // Database/provider error messages, stacks and extra properties can contain
  // SQL parameters, credentials or personal data. Log classifications only.
  serializers: errorLogSerializers,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
