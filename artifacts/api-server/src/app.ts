import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
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

const originValues = [
  process.env.CORS_ALLOWED_ORIGINS,
  process.env.REPLIT_DOMAINS,
  process.env.REPLIT_DEV_DOMAIN,
]
  .filter(Boolean)
  .flatMap((value) => value!.split(","))
  .map((value) => value.trim())
  .filter(Boolean)
  .flatMap((value) => {
    const normalized = value.replace(/\/+$/, "");
    return /^https?:\/\//i.test(normalized) ? [normalized] : [`https://${normalized}`];
  });
const allowedOrigins = new Set(originValues);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }),
);
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

app.use("/api/admin", (req, res, next) => {
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

  let requestOrigin: string;
  let providedOrigin: string;
  try {
    providedOrigin = new URL(origin).origin;
    requestOrigin = new URL(`${req.protocol}://${req.get("host") ?? ""}`).origin;
  } catch {
    res.status(403).json({ error: "Invalid administrator request origin" });
    return;
  }

  if (!allowedOrigins.has(providedOrigin) && providedOrigin !== requestOrigin) {
    res.status(403).json({ error: "Cross-origin administrator action denied" });
    return;
  }

  next();
});

app.use("/api", router);

export default app;
