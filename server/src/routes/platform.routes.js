import { Router } from "express";
import { body, param } from "express-validator";
import * as ctrl from "../controllers/platform.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidId, validate } from "../middleware/validate.js";

export const platformRouter = Router();

platformRouter.use(requireAuth(), requireRole("super_admin"));

platformRouter.get("/dashboard", ctrl.platformDashboard);

platformRouter.get(
  "/companies",
  validate([body("name").optional()]),
  ctrl.listCompanies
);
platformRouter.get("/companies/:id", validate([param("id").custom(isValidId).withMessage("Invalid company id")]), ctrl.getCompany);
platformRouter.post(
  "/companies",
  validate([
    body("name").trim().notEmpty().withMessage("Company name is required"),
    body("plan").optional().isIn(["trial", "business", "enterprise"]).withMessage("Unknown plan"),
    body("status").optional().isIn(["trial", "active", "suspended"]).withMessage("Unknown status"),
  ]),
  ctrl.createCompany
);
platformRouter.patch(
  "/companies/:id",
  validate([param("id").custom(isValidId).withMessage("Invalid company id")]),
  ctrl.updateCompany
);
platformRouter.delete("/companies/:id", validate([param("id").custom(isValidId).withMessage("Invalid company id")]), ctrl.deleteCompany);

platformRouter.get("/subscriptions", ctrl.subscriptions);
platformRouter.get("/audit", ctrl.listAudit);

/* --- extended Super Admin pages --- */

platformRouter.get("/invoices", ctrl.listInvoices);
platformRouter.get("/invoices/latest", ctrl.latestInvoice);
platformRouter.get("/subscription-lifecycle", ctrl.subscriptionLifecycle);
platformRouter.get("/usage", ctrl.usageLimits);
platformRouter.get("/activity", ctrl.platformActivity);
platformRouter.post(
  "/audit",
  validate([body("action").trim().notEmpty().withMessage("action is required")]),
  ctrl.writeAudit
);

platformRouter.get("/role-templates", ctrl.listRoleTemplates);
platformRouter.post(
  "/role-templates",
  validate([body("name").trim().notEmpty().withMessage("Template name is required")]),
  ctrl.createRoleTemplate
);
platformRouter.delete(
  "/role-templates/:id",
  validate([param("id").custom(isValidId).withMessage("Invalid template id")]),
  ctrl.deleteRoleTemplate
);

platformRouter.get("/super-admins", ctrl.listSuperAdmins);
platformRouter.patch(
  "/super-admins/:id",
  validate([param("id").custom(isValidId).withMessage("Invalid account id"), body("status").isIn(["active", "inactive"]).withMessage("Unknown status")]),
  ctrl.patchSuperAdmin
);

platformRouter.get("/security", ctrl.getSecuritySettings);
platformRouter.patch("/security", ctrl.patchSecuritySettings);

platformRouter.get("/integrations", ctrl.listIntegrations);
platformRouter.patch(
  "/integrations/:key",
  validate([body("connected").isBoolean().withMessage("connected must be a boolean")]),
  ctrl.patchIntegration
);

platformRouter.get("/global-search", ctrl.globalSearch);

platformRouter.patch(
  "/companies/:id/plan",
  validate([param("id").custom(isValidId).withMessage("Invalid company id"), body("plan").isIn(["trial", "business", "enterprise"]).withMessage("Unknown plan")]),
  ctrl.assignPlan
);

platformRouter.get("/tickets", ctrl.listTickets);
platformRouter.post(
  "/tickets",
  validate([body("subject").trim().notEmpty().withMessage("Subject is required")]),
  ctrl.createTicket
);
platformRouter.patch(
  "/tickets/:id",
  validate([param("id").custom(isValidId).withMessage("Invalid ticket id")]),
  ctrl.updateTicket
);

platformRouter.get("/health", ctrl.systemHealth);
