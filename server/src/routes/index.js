import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { announcementRouter } from "./announcement.routes.js";
import { authRouter } from "./auth.routes.js";
import { dashboard } from "../controllers/dashboard.controller.js";
import { departmentRouter } from "./department.routes.js";
import { hrRouter } from "./hr.routes.js";
import { messageRouter } from "./message.routes.js";
import { notificationRouter } from "./notification.routes.js";
import { platformRouter } from "./platform.routes.js";
import { projectRouter } from "./project.routes.js";
import { requestRouter } from "./request.routes.js";
import { taskRouter } from "./task.routes.js";
import { timeRouter } from "./time.routes.js";
import { timesheetRouter } from "./timesheet.routes.js";
import { userRouter } from "./user.routes.js";
import { orgChart } from "../controllers/orgChart.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" }, message: "API healthy" }));

apiRouter.use("/auth", authRouter);

// Everything below requires authentication (guarded per router/route).
apiRouter.get("/dashboard", requireAuth(), asyncHandler(dashboard));
apiRouter.get("/org-chart", requireAuth(), asyncHandler(orgChart));
apiRouter.use("/users", userRouter);
apiRouter.use("/departments", departmentRouter);
apiRouter.use("/hr", hrRouter);
apiRouter.use("/projects", projectRouter);
apiRouter.use("/tasks", taskRouter);
apiRouter.use("/time", timeRouter);
apiRouter.use("/timesheets", timesheetRouter);
apiRouter.use("/requests", requestRouter);
apiRouter.use("/messages", messageRouter);
apiRouter.use("/announcements", announcementRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/platform", platformRouter);
