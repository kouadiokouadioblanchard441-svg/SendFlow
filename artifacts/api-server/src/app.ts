import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { ADMIN_ROUTE_PREFIX } from "./lib/admin-route-prefix";
import { shouldBlockSharedNeonApiRequest } from "./lib/shared-neon-preview-guard";
import { getAllowedOrigins, normalizeHttpOrigin } from "./lib/origin-policy";
import { parseTrustProxyHops } from "./lib/trust-proxy-policy";
import router from "./routes";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", parseTrustProxyHops(process.env.TRUST_PROXY_HOPS));
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
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

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
app.use("/api", (req, res, next) => {
  if (
    !shouldBlockSharedNeonApiRequest(
      req.method,
      req.originalUrl,
    )
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
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api/me", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");
  next();
});

app.use("/api/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");
  next();
});

app.use(`/api${ADMIN_ROUTE_PREFIX}`, (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private");

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (!origin) {
    const { userId } = getAuth(req);
    if (userId && req.headers.cookie) {
      res.status(403).json({ error: "Origin header is required for administrator actions" });
      return;
    }
    next();
    return;
  }

  const providedOrigin = normalizeHttpOrigin(origin);
  if (!providedOrigin) {
    res.status(403).json({ error: "Invalid administrator request origin" });
    return;
  }

  if (!allowedOrigins.has(providedOrigin)) {
    res.status(403).json({ error: "Cross-origin administrator action denied" });
    return;
  }

  next();
});

app.use("/api", router);

export default app;
