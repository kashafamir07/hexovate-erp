import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/department.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const departmentRouter = Router();

departmentRouter.use(requireAuth());

departmentRouter.get("/", ctrl.listDepartments);
departmentRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid department id")]), ctrl.getDepartment);

departmentRouter.use(requireRole("admin", "hr", "company_admin", "super_admin"));
departmentRouter.post("/", validate([body("name").trim().notEmpty().withMessage("Name is required")]), ctrl.createDepartment);
departmentRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid department id")]), ctrl.updateDepartment);
departmentRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid department id")]), ctrl.deleteDepartment);
