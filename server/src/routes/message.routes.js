import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/message.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const messageRouter = Router();

messageRouter.use(requireAuth());

messageRouter.get("/", ctrl.listConversations);
messageRouter.post("/", validate([body("body").notEmpty().withMessage("Message body is required")]), ctrl.sendMessage);
messageRouter.patch("/:id/read", ctrl.markRead);
messageRouter.get("/:id", ctrl.getConversation);
messageRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid message id")]), ctrl.deleteMessage);
