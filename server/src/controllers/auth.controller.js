import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, ok } from "../utils/response.js";
import { env } from "../config/env.js";

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
import { userPublic } from "../utils/serialize.js";
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../utils/token.js";

const safeUser = async (id) => {
  const user = await User.findById(id).populate("department", "name").populate("manager", "firstName lastName").lean();
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

/** POST /api/auth/register — self-service signup (always employee role). */
export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body;
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    passwordHash,
    phone: phone || "",
    role: "employee",
    status: "active",
  });

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, token, refreshToken);
  return created(res, { user: userPublic(await safeUser(user._id)), accessToken: token }, "Account created");
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() })
    .select("+passwordHash")
    .lean();
  const valid = user && (await bcrypt.compare(String(password || ""), user.passwordHash));
  if (!valid) throw new ApiError(401, "Invalid email or password");
  if (user.status !== "active") throw new ApiError(403, "Account is not active");

  await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, token, refreshToken);
  return ok(res, { user: userPublic(await safeUser(user._id)), accessToken: token }, "Logged in");
});

/** POST /api/auth/logout */
export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);
  return ok(res, null, "Logged out");
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req, res) => {
  const user = await safeUser(req.userId);
  return ok(res, { user: userPublic(user) }, "Current user");
});

/** POST /api/auth/forgot-password — creates a single-use reset token (returned in dev only). */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() }).select("_id email firstName status").lean();
  if (!user || user.status !== "active") {
    // identical response either way — never reveal whether an account exists
    return ok(res, {}, "If an account exists for that email, a reset link has been sent");
  }
  const raw = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: sha256(raw), resetExpires: new Date(Date.now() + 30 * 60 * 1000) } });
  // In development the demo has no mail server, so return the token for the reset screen.
  return ok(res, { devToken: env.isProd ? undefined : raw }, "Reset link generated");
});

/** POST /api/auth/reset-password — exchanges a valid token for a new password. */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token) throw new ApiError(400, "Reset token is required");
  const user = await User.findOne({ resetTokenHash: sha256(token) }).select("+resetTokenHash +resetExpires passwordHash");
  if (!user || !user.resetExpires || user.resetExpires < new Date()) {
    throw new ApiError(400, "Invalid or expired reset token — request a new one");
  }
  user.passwordHash = await bcrypt.hash(String(newPassword || ""), 12);
  user.resetTokenHash = null;
  user.resetExpires = null;
  await user.save();
  return ok(res, {}, "Password reset — you can now sign in");
});

/** POST /api/auth/refresh — rotates the refresh cookie into a new access token. */
export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = (req.cookies && req.cookies[REFRESH_TOKEN_COOKIE]) || req.body?.refreshToken;
  if (!refreshToken) throw new ApiError(401, "No refresh token");
  let payload;
  try {
    payload = verifyToken(refreshToken, "refresh");
  } catch {
    clearAuthCookies(res);
    throw new ApiError(401, "Invalid or expired refresh token");
  }
  const user = await User.findById(payload.sub).lean();
  if (!user) throw new ApiError(401, "Account no longer exists");

  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  setAuthCookies(res, accessToken, newRefresh);
  return ok(res, { user: userPublic(await safeUser(user._id)), accessToken }, "Token refreshed");
});
