import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/request.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const requestRouter = Router();

requestRouter.use(requireAuth());

requestRouter.get("/", ctrl.listRequests);
requestRouter.post(
  "/",
  validate([
    body("type").isIn(["leave", "permission", "equipment", "expense", "other"]).withMessage("Unknown request type"),
    body("title").trim().notEmpty().withMessage("Title is required"),
  ]),
  ctrl.createRequest
);
requestRouter.get("/:id", validate([param("id").custom(isValidId).withMessage("Invalid request id")]), ctrl.getRequest);
requestRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid request id")]), ctrl.updateRequest);
requestRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid request id")]), ctrl.withdrawRequest);
requestRouter.post("/:id/approve", validate([param("id").custom(isValidId).withMessage("Invalid request id")]), ctrl.approveRequest);
requestRouter.post("/:id/reject", validate([param("id").custom(isValidId).withMessage("Invalid request id")]), ctrl.rejectRequest);
