import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/** Never throttle in automated tests (supertest hits are all from one IP). */
const skipWhenDisabled = () => process.env.NODE_ENV === "test" || !env.rateLimitEnabled;

/** Standard security headers (HSTS, X-Content-Type-Options, frameguard, etc.). */
export const securityHeaders = helmet();

const RATE_LIMIT_MESSAGE = {
  success: false,
  message: "Too many requests, please try again later",
  errors: [],
};

/**
 * Global API limiter — every /api request counts toward one per-IP budget.
 * Mounted before the router so it also covers the auth sub-routes.
 */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimitApiWindowMs,
  limit: env.rateLimitApiMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  message: RATE_LIMIT_MESSAGE,
});

/**
 * Stricter limiter for credential-bearing auth routes
 * (login, register, forgot/reset password).
 */
export const authLimiter = rateLimit({
  windowMs: env.rateLimitAuthWindowMs,
  limit: env.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  message: RATE_LIMIT_MESSAGE,
});