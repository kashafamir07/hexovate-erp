import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env (and fall back to repository root .env).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const bool = (v) => v === "true" || v === "1";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || "1d",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || "7d",
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSecure: bool(process.env.COOKIE_SECURE),
  // Rate limiting (set RATE_LIMIT_ENABLED=false to disable — never in production).
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30,
  rateLimitAuthWindowMs: (Number(process.env.RATE_LIMIT_AUTH_WINDOW_MIN) || 15) * 60 * 1000,
  rateLimitApiMax: Number(process.env.RATE_LIMIT_API_MAX) || 600,
  rateLimitApiWindowMs: (Number(process.env.RATE_LIMIT_API_WINDOW_MIN) || 15) * 60 * 1000,
};
