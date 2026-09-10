import { Router } from "express";
import { body } from "express-validator";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";

export const authRouter = Router();

// Credential routes get a stricter per-IP budget on top of the global API limiter.
authRouter.use(authLimiter);

authRouter.post(
  "/register",
  validate([
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("email").trim().isEmail().withMessage("A valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ]),
  ctrl.register
);

authRouter.post(
  "/login",
  validate([
    body("email").trim().isEmail().withMessage("A valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ]),
  ctrl.login
);

authRouter.post(
  "/forgot-password",
  validate([body("email").trim().isEmail().withMessage("A valid email is required")]),
  ctrl.forgotPassword
);

authRouter.post(
  "/reset-password",
  validate([body("token").notEmpty().withMessage("Reset token is required"), body("newPassword").isLength({ min: 10 }).withMessage("New password must be at least 10 characters")]),
  ctrl.resetPassword
);

authRouter.post("/logout", ctrl.logout);
authRouter.get("/me", requireAuth(), ctrl.me);
authRouter.post("/refresh", ctrl.refresh);
