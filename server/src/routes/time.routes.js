import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/time.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const timeRouter = Router();

timeRouter.use(requireAuth());

timeRouter.post("/start", ctrl.startTimer);
timeRouter.post("/stop", ctrl.stopTimer);
timeRouter.get("/current", ctrl.getCurrent);
timeRouter.get("/summary", ctrl.timeSummary);
timeRouter.get("/", ctrl.listTime);
timeRouter.post("/", validate([body("date").optional(), body("minutes").optional().isInt({ min: 1 }).withMessage("Minutes must be positive")]), ctrl.createManualEntry);
timeRouter.patch("/:id", validate([param("id").custom(isValidId).withMessage("Invalid time entry id")]), ctrl.updateTime);
timeRouter.delete("/:id", validate([param("id").custom(isValidId).withMessage("Invalid time entry id")]), ctrl.deleteTime);
