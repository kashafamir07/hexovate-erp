import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, verifyToken } from "../utils/token.js";

function tokenFrom(req) {
  if (req.cookies && req.cookies[ACCESS_TOKEN_COOKIE]) return req.cookies[ACCESS_TOKEN_COOKIE];
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

/**
 * Attach the authenticated user to req.user (from an access token).
 * Optional when `optional` is true — anonymous requests pass through.
 */
export const requireAuth = (optional = false) =>
  asyncHandler(async (req, _res, next) => {
    const token = tokenFrom(req);
    if (!token) {
      if (optional) return next();
      throw new ApiError(401, "Authentication required");
    }
    let payload;
    try {
      payload = verifyToken(token, "access");
    } catch {
      if (optional) return next();
      throw new ApiError(401, "Invalid or expired token");
    }
    const user = await User.findById(payload.sub).select("+passwordHash").lean();
    if (!user) {
      if (optional) return next();
      throw new ApiError(401, "Account no longer exists");
    }
    if (user.status !== "active") throw new ApiError(403, "Account is not active");
    req.user = user;
    req.userId = String(user._id);
    return next();
  });

/** requireRole('admin') or requireRole('manager', 'admin', 'hr') */
export const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw new ApiError(401, "Authentication required");
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Requires role: ${roles.join(" or ")}`);
    }
    return next();
  });

export { REFRESH_TOKEN_COOKIE };
