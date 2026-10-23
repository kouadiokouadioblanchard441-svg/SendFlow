import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { shouldBlockSharedNeonApiRequest, isViewerRouteCandidate } from "./lib/shared-neon-preview-guard";
import { enforcePreviewAccountAccess } from "./lib/preview-access-middleware";
import { getAllowedOrigins, normalizeHttpOrigin } from "./lib/origin-policy";
import { parseTrustProxyHops } from "./lib/trust-proxy-policy";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorLogSerializers } from "./lib/log-safety";
import { httpErrorHandler } from "./lib/http-error-handler";
import { enforceIpAccess } from "@workspace/db/ip-blocklist";
import { apiRequestSecurity } from "./lib/api-request-security";

const app: Express = express();

app.disable("x-powered-by");
app.set(
  "trust proxy",
  parseTrustProxyHops(process.env.TRUST_PROXY_HOPS, process.env.NODE_ENV),
);
// Before CORS/preflight, body parsing, auth and every API route.
app.use(async (req, res, next) => {
  if (await enforceIpAccess(req, res)) next();
});
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      ...errorLogSerializers,
      req(req) {
        const path = req.url?.split("?")[0] ?? "";
        return {
          id: req.id,
          method: req.method,
          url: path,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = getAllowedOrigins(process.env);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const normalizedOrigin = normalizeHttpOrigin(origin);
      if (!origin || (normalizedOrigin && allowedOrigins.has(normalizedOrigin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }),
);
app.use("/api", apiRequestSecurity(allowedOrigins));
app.use("/api", (req, res, next) => {
  if (
    !shouldBlockSharedNeonApiRequest(
      req.method,
      req.originalUrl,
    ) || isViewerRouteCandidate(req.method, req.originalUrl)
  ) {
    next();
    return;
  }

  const path = req.originalUrl.split("?")[0] ?? "";
  req.log.warn(
    { method: req.method, path },
    "Blocked live-data API request in shared-Neon runtime",
  );
  res.setHeader("Cache-Control", "no-store, private");
  res.status(503).json({
    error: "Les opérations sur les comptes ne sont pas disponibles dans cet aperçu.",
  });
});
app.use(express.json({ limit: "100kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "100kb", parameterLimit: 100 }));
app.use("/api", enforcePreviewAccountAccess);
app.use("/api/me", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");
  next();
});

app.use("/api/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");
  next();
});

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  res.status(404).json({ error: "API route not found" });
});
app.use(httpErrorHandler);

export default app;
