import { Router } from "express";
import { body, param } from "express-validator";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";
import * as overview from "../controllers/hrOverview.controller.js";
import * as people from "../controllers/hrPeople.controller.js";
import * as attendance from "../controllers/hrAttendance.controller.js";
import * as performance from "../controllers/hrPerformance.controller.js";
import * as finance from "../controllers/hrFinance.controller.js";
import * as ops from "../controllers/hrOps.controller.js";
import * as portal from "../controllers/hrPortal.controller.js";

export const hrRouter = Router();

hrRouter.use(requireAuth());

// Every leader role (manager, executive, hr, admin, CEO, company/super admins)
const leader = requireRole("manager", "executive", "hr", "admin", "ceo", "company_admin", "super_admin");
// Org-level analytics only (executives/CEO/HR/org admins)
const orgOnly = requireRole("executive", "hr", "admin", "ceo", "company_admin", "super_admin");
// Team-lead features (not executives/CEO — they have no per-employee actions)
const teamLead = requireRole("manager", "hr", "admin", "company_admin", "super_admin");

/* dashboards & departments */
hrRouter.get("/dashboard", leader, overview.hrDashboard);
hrRouter.get("/org-home", orgOnly, overview.hrOrgHome);
hrRouter.get("/priorities", orgOnly, overview.hrPriorities);
hrRouter.get("/departments", orgOnly, overview.hrDepartments);
hrRouter.get("/department", leader, overview.hrMyDepartment);
hrRouter.patch("/department", leader, overview.patchMyDepartment);

/* people */
hrRouter.get("/people", leader, people.hrPeopleList);
hrRouter.get("/people/:id", leader, validate([param("id").custom(isValidId).withMessage("Invalid user id")]), people.hrPeopleDetail);
hrRouter.get("/people/:id/documents", leader, validate([param("id").custom(isValidId).withMessage("Invalid user id")]), people.personDocuments);
hrRouter.post(
  "/people/:id/documents",
  requireRole("hr", "admin", "company_admin", "super_admin"),
  validate([
    param("id").custom(isValidId).withMessage("Invalid user id"),
    body("title").trim().notEmpty().withMessage("Document title is required"),
    body("category").optional().isIn(["contract", "id", "review", "tax", "other"]).withMessage("Unknown category"),
  ]),
  people.personDocumentCreate
);
hrRouter.delete(
  "/people/:id/documents/:docId",
  requireRole("hr", "admin", "company_admin", "super_admin"),
  validate([param("id").custom(isValidId).withMessage("Invalid user id"), param("docId").custom(isValidId).withMessage("Invalid document id")]),
  people.personDocumentDelete
);
hrRouter.get("/people/:id/time-logs", leader, validate([param("id").custom(isValidId).withMessage("Invalid user id")]), people.personTimeLogs);
hrRouter.get("/people/:id/leave-history", leader, validate([param("id").custom(isValidId).withMessage("Invalid user id")]), people.personLeaveHistory);

/* attendance */
hrRouter.get("/attendance/today", leader, attendance.hrAttendanceToday);
hrRouter.get("/attendance/summary", leader, attendance.hrAttendanceSummary);
hrRouter.get("/attendance/trend", leader, attendance.hrAttendanceTrend);
hrRouter.get("/attendance", leader, attendance.hrAttendanceList);
hrRouter.get("/attendance/:id", leader, validate([param("id").custom(isValidId).withMessage("Invalid user id")]), attendance.hrAttendanceHistory);

/* performance */
hrRouter.get("/performance", leader, performance.hrPerformanceList);
hrRouter.patch("/performance/:id", leader, validate([param("id").custom(isValidId).withMessage("Invalid review id")]), performance.hrPerformanceUpdate);

/* payroll & recruitment (org level) */
hrRouter.get("/payroll", orgOnly, finance.hrPayroll);
hrRouter.get("/recruitment", orgOnly, finance.hrRecruitment);

/* team task management */  hrRouter.get("/team-tasks/stats", teamLead, ops.hrTaskStats);
  hrRouter.get("/team-activity", teamLead, ops.hrTeamActivity);
hrRouter.get("/team-tasks", teamLead, ops.hrTeamTasks);
hrRouter.post("/team-tasks", teamLead, ops.hrCreateTask);
hrRouter.patch("/team-tasks/:id", teamLead, validate([param("id").custom(isValidId).withMessage("Invalid task id")]), ops.hrUpdateTask);
hrRouter.delete("/team-tasks/:id", teamLead, validate([param("id").custom(isValidId).withMessage("Invalid task id")]), ops.hrDeleteTask);

/* leaves & approvals (scoped list with requester info) */
hrRouter.get("/leaves", leader, ops.hrLeavesList);

/* calendar & reports */
hrRouter.get("/calendar", leader, ops.hrCalendar);
hrRouter.get("/reports", leader, ops.hrReports);

/* HR portal / department-head dashboard + lifecycle (also used by DH) */
hrRouter.get("/portal/dashboard", leader, portal.hrPortalDashboard);
hrRouter.get("/portal/onboarding", leader, portal.hrOnboardingList);
hrRouter.post("/portal/onboarding", teamLead, validate([body("userId").custom(isValidId).withMessage("Invalid employee id")]), portal.hrCreateOnboarding);
hrRouter.patch("/portal/onboarding/:id", teamLead, validate([param("id").custom(isValidId).withMessage("Invalid record id")]), portal.hrUpdateOnboarding);
hrRouter.delete("/portal/onboarding/:id", teamLead, validate([param("id").custom(isValidId).withMessage("Invalid record id")]), portal.hrDeleteOnboarding);
hrRouter.get("/portal/offboarding", leader, portal.hrOffboardingList);
hrRouter.post("/portal/offboarding", teamLead, validate([body("userId").custom(isValidId).withMessage("Invalid employee id")]), portal.hrCreateOffboarding);
hrRouter.patch("/portal/offboarding/:id", teamLead, validate([param("id").custom(isValidId).withMessage("Invalid record id")]), portal.hrUpdateOffboarding);
hrRouter.delete("/portal/offboarding/:id", teamLead, validate([param("id").custom(isValidId).withMessage("Invalid record id")]), portal.hrDeleteOffboarding);
hrRouter.get("/portal/documents", orgOnly, portal.hrDocuments);
hrRouter.get("/portal/reports", leader, portal.hrPortalReports);
