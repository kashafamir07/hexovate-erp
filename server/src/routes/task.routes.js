import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/task.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const taskRouter = Router();

taskRouter.use(requireAuth());

taskRouter.get("/", ctrl.listTasks);
taskRouter.post(
  "/",
  validate([
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("priority").optional().isIn(["low", "medium", "high", "Low", "Medium", "High"]).withMessage("Unknown priority"),
    body("status").optional().isIn(["todo", "in_progress", "review", "completed", "To Do", "In Progress", "In Review", "Done"]).withMessage("Unknown status"),
    body("project").optional().custom(isValidId).withMessage("Invalid project id"),
    body("assignedTo").optional().custom(isValidId).withMessage("Invalid user id"),
  ]),
  ctrl.createTask
);
taskRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid task id")]), ctrl.getTask);
taskRouter.patch("/:id/status", validate([param("id").custom(isValidId).withMessage("Invalid task id"), body("status").notEmpty().withMessage("Status is required")]), ctrl.updateTaskStatus);
taskRouter.patch("/:id/complete", validate([param("id").custom(isValidId).withMessage("Invalid task id")]), ctrl.completeTask);
taskRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid task id")]), ctrl.updateTask);
taskRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid task id")]), ctrl.deleteTask);
