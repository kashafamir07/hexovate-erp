import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/project.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const projectRouter = Router();

projectRouter.use(requireAuth());

projectRouter.get("/", ctrl.listProjects);
projectRouter.get("/:id/board", validate([param("id").custom(isValidId).withMessage("Invalid project id")]), ctrl.getProjectBoard);
projectRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid project id")]), ctrl.getProject);

projectRouter.use(requireRole("admin", "hr", "manager"));
projectRouter.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("status").optional().isIn(["active", "on_hold", "completed"]).withMessage("Unknown status"),
  ]),
  ctrl.createProject
);
projectRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid project id")]), ctrl.updateProject);
projectRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid project id")]), ctrl.deleteProject);
projectRouter.post("/:id/members", validate([param("id").custom(isValidId).withMessage("Invalid project id"), body("userId").custom(isValidId).withMessage("Invalid user id")]), ctrl.addProjectMember);
projectRouter.delete("/:id/members/:userId", validate([param("id").custom(isValidId).withMessage("Invalid project id"), param("userId").custom(isValidId).withMessage("Invalid user id")]), ctrl.removeProjectMember);
