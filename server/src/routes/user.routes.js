import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/user.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const userRouter = Router();

userRouter.use(requireAuth());

// Profile shortcuts (before :id routes)
userRouter.get("/me/profile", ctrl.myProfile);
userRouter.patch("/me", ctrl.updateMe);
userRouter.patch("/me/password", validate([body("currentPassword").notEmpty().withMessage("Current password is required"), body("newPassword").isLength({ min: 10 }).withMessage("New password must be at least 10 characters")]), ctrl.changeMyPassword);

userRouter.get("/", ctrl.listUsers);
userRouter.post(
  "/",
  requireRole("admin", "hr", "company_admin", "super_admin"),
  validate([
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("email").trim().isEmail().withMessage("A valid email is required"),
    body("role").optional().isIn(["employee", "manager", "admin", "hr", "executive", "ceo", "company_admin", "super_admin"]).withMessage("Unknown role"),
  ]),
  ctrl.createUser
);
userRouter.get("/me/tasks", ctrl.userTasks);
userRouter.get("/me/projects", ctrl.userProjects);
userRouter.get("/me/timesheets", ctrl.userTimesheets);
userRouter.get("/:id/tasks", validate([param("id").custom(isValidId).withMessage("Invalid user id")]), ctrl.userTasks);
userRouter.get("/:id/projects", validate([param("id").custom(isValidId).withMessage("Invalid user id")]), ctrl.userProjects);
userRouter.get("/:id/timesheets", validate([param("id").custom(isValidId).withMessage("Invalid user id")]), ctrl.userTimesheets);
userRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid user id")]), ctrl.getUser);
userRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid user id")]), ctrl.updateUser);
userRouter.delete("/:id", requireRole("admin", "hr", "company_admin", "super_admin"), validate([param("id").custom(isValidId).withMessage("Invalid user id")]), ctrl.deleteUser);
