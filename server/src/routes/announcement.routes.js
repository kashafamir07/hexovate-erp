import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/announcement.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const announcementRouter = Router();

announcementRouter.use(requireAuth());

announcementRouter.get("/", ctrl.listAnnouncements);
announcementRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid announcement id")]), ctrl.getAnnouncement);

announcementRouter.use(requireRole("admin", "hr", "ceo", "company_admin", "super_admin"));
announcementRouter.post("/", validate([body("title").trim().notEmpty().withMessage("Title is required"), body("content").trim().notEmpty().withMessage("Content is required")]), ctrl.createAnnouncement);
announcementRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid announcement id")]), ctrl.updateAnnouncement);
announcementRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid announcement id")]), ctrl.deleteAnnouncement);
