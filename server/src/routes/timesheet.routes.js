import { Router } from "express";
import { param } from "express-validator";
import * as ctrl from "../controllers/timesheet.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const timesheetRouter = Router();

timesheetRouter.use(requireAuth());

timesheetRouter.get("/mine/current", ctrl.myCurrentWeek);
timesheetRouter.get("/", ctrl.listTimesheets);
timesheetRouter.post("/", ctrl.createTimesheet);
timesheetRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid timesheet id")]), ctrl.getTimesheet);
timesheetRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid timesheet id")]), ctrl.updateTimesheet);
timesheetRouter.post("/:id/submit", validate([param("id").custom(isValidId).withMessage("Invalid timesheet id")]), ctrl.submitTimesheet);timesheetRouter.post("/:id/approve", requireRole("admin", "hr", "manager", "company_admin", "super_admin"), validate([param("id").custom(isValidId).withMessage("Invalid timesheet id")]), ctrl.approveTimesheet);
  timesheetRouter.post("/:id/reject", requireRole("admin", "hr", "manager", "company_admin", "super_admin"), validate([param("id").custom(isValidId).withMessage("Invalid timesheet id")]), ctrl.rejectTimesheet);
