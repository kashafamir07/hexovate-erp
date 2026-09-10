import { Router } from "express";
import { param } from "express-validator";
import * as ctrl from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth());

notificationRouter.get("/", ctrl.listNotifications);
notificationRouter.patch("/read-all", ctrl.markAllNotificationsRead);
notificationRouter.patch("/:id/read", validate([param("id").custom(isValidId).withMessage("Invalid notification id")]), ctrl.markNotificationRead);
notificationRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid notification id")]), ctrl.deleteNotification);
