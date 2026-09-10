import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const ACCESS_TOKEN_COOKIE = "hexovate_access";
export const REFRESH_TOKEN_COOKIE = "hexovate_refresh";

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), type: "access" }, env.jwtSecret, {
    expiresIn: env.jwtAccessTtl,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user._id), type: "refresh" }, env.jwtSecret, {
    expiresIn: env.jwtRefreshTtl,
  });
}

export function verifyToken(token, expectedType) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (expectedType && payload.type !== expectedType) {
    const err = new Error("Unexpected token type");
    err.name = "JsonWebTokenError";
    throw err;
  }
  return payload;
}

const cookieOptions = (maxAgeSeconds) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProd && env.cookieSecure,
  maxAge: maxAgeSeconds * 1000,
  path: "/",
});

export function setAuthCookies(res, accessToken, refreshToken) {
  const { jwtAccessTtl, jwtRefreshTtl } = env;
  const accessSeconds = parseTtlSeconds(jwtAccessTtl);
  const refreshSeconds = parseTtlSeconds(jwtRefreshTtl);
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(accessSeconds));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(refreshSeconds));
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
}

function parseTtlSeconds(ttl) {
  const match = String(ttl).match(/^(\d+)([smhd])?$/);
  if (!match) return 3600;
  const n = Number(match[1]);
  const unit = match[2] || "s";
  const map = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * map[unit];
}
