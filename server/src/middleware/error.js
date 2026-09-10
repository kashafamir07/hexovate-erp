import mongoose from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(_req, res) {
  return res.status(404).json({ success: false, message: "Route not found", errors: [] });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || [];

  if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = "Validation failed";
    errors = Object.entries(err.errors).map(([field, e]) => ({ field, msg: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path} value`;
  } else if (err.code === 11000) {
    status = 409;
    const key = Object.keys(err.keyPattern || {})[0] || "field";
    message = `${key} already exists`;
    errors = [{ field: key, msg: `${key} already exists` }];
  } else if (err.type === "entity.too.large" || err.status === 413) {
    status = 413;
    message = "Request body too large";
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    status = 401;
    message = "Invalid or expired token";
  } else if (!err.isOperational) {
    // Programmer/unknown error — never leak internals.
    // eslint-disable-next-line no-console
    if (!env.isProd) console.error(err);
    message = "Internal server error";
  }

  if (status >= 500 && env.isProd) message = "Internal server error";

  return res.status(status).json({ success: false, message, errors });
}
