import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiLimiter, securityHeaders } from "./middleware/security.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / no-origin requests (curl, tests, same host).
        if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
        // Dev convenience: allow any localhost origin, but never in production.
        if (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      maxAge: 86400,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(cookieParser());

  app.get("/", (_req, res) =>
    res.json({ success: true, data: { service: "Hexovate ERP API", docs: "/api/health" }, message: "OK" })
  );
  app.use("/api", apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
