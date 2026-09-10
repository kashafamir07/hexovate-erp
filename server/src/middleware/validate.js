import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

/**
 * validate([...chains]) — runs express-validator chains and throws a 422
 * with a flat {field,msg} error list when anything fails.
 */
export const validate = (chains) => [
  ...chains,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const errors = result.array().map((e) => ({ field: e.path || e.param, msg: e.msg, location: e.location }));
    // Malformed URL params (ids) are client errors → 400; body failures stay 422.
    const hasParamError = errors.some((e) => e.location === "params");
    return next(new ApiError(hasParamError ? 400 : 422, hasParamError ? "Invalid request parameter" : "Validation failed", errors));
  },
];

export const isValidId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value));
