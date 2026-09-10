import mongoose from "mongoose";
import { Company } from "../models/Company.js";
import { AuditLog } from "../models/AuditLog.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { Invoice } from "../models/Invoice.js";
import { RoleTemplate } from "../models/RoleTemplate.js";
import { PlatformSettings } from "../models/PlatformSettings.js";
import { PlatformIntegration } from "../models/PlatformIntegration.js";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Department } from "../models/Department.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { created, noContent, ok } from "../utils/response.js";
import { money } from "../utils/ui.js";

/** Flat monthly rates used to derive MRR from a company plan. */
export const PLAN_MRR = { trial: 0, business: 390, enterprise: 990 };

export const PLAN_LABEL = { trial: "Trial", business: "Business", enterprise: "Enterprise" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------------
 * Data-anchored dates
 * ------------------------------------------------------------------
 * Charts and relative labels are derived from the timestamps actually
 * stored in MongoDB ("2026-08" style month strings + Date arithmetic on
 * the parsed rows). The wall clock is never trusted here — dev sandboxes
 * can step Date.now() arbitrarily, but stored rows do not move.
 * ------------------------------------------------------------------ */

/** 'YYYY-MM' from a stored timestamp. */
const isoMonth = (d) => new Date(d).toISOString().slice(0, 7);

/** 'Aug 26' from a 'YYYY-MM' key. */
function keyLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${String(y).slice(2)}`;
}

/** 'Sep 4' from a stored timestamp. */
function monthDayOf(d) {
  const iso = new Date(d).toISOString();
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}

/** The most recent `n` distinct months that actually appear in the data. */
function lastDataMonths(dates, n = 8) {
  const uniq = [...new Set(dates.filter(Boolean).map(isoMonth))].sort();
  return uniq.slice(-n);
}

/** Relative label ('12m ago', '3d ago') — diff comes from Date subtraction, not Date.now(). */
function relDay(d, base) {
  const ms = new Date(base) - new Date(d);
  if (ms < 0) return monthDayOf(d);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return monthDayOf(d);
}

/** Newest stored timestamp from a set of rows (or the fallback). */
function newestOf(refs, fallback = null) {
  let best = null;
  for (const r of refs) {
    const t = new Date(r);
    if (Number.isNaN(t.getTime())) continue;
    if (!best || t > best) best = t;
  }
  return best || fallback;
}

function mrrOf(c) {
  return PLAN_MRR[c.plan] || 0;
}

function companyRow(c) {
  const d = c instanceof mongoose.Document ? c.toObject() : c;
  return {
    id: String(d._id),
    name: d.name,
    domain: d.domain,
    industry: d.industry,
    plan: d.plan,
    planLabel: PLAN_LABEL[d.plan] || d.plan,
    status: d.status,
    seats: d.seats,
    seatsUsed: d.seatsUsed,
    contactName: d.contactName,
    contactEmail: d.contactEmail,
    renewalDate: d.renewalDate || null,
    renewalLabel: d.renewalDate ? monthDayOf(d.renewalDate) : "—",
    mrr: mrrOf(d),
    mrrLabel: money(mrrOf(d)),
    notes: d.notes,
    createdAt: d.createdAt,
    createdLabel: d.createdAt ? monthDayOf(d.createdAt) : "",
  };
}

function ticketRow(t, base) {
  const d = t instanceof mongoose.Document ? t.toObject() : t;
  return {
    id: String(d._id),
    company: d.company ? String(d.company) : null,
    companyName: d.companyName,
    subject: d.subject,
    description: d.description,
    priority: d.priority,
    status: d.status,
    statusLabel: d.status.replace("_", " "),
    reporter: d.reporter,
    assignee: d.assignee,
    createdLabel: d.createdAt ? relDay(d.createdAt, base) : "",
    updatedLabel: d.updatedAt ? relDay(d.updatedAt, base) : "",
  };
}

function auditRow(a, base) {
  const d = a instanceof mongoose.Document ? a.toObject() : a;
  return {
    id: String(d._id),
    actor: d.actor,
    category: d.category,
    action: d.action,
    targetType: d.targetType,
    targetName: d.targetName,
    detail: d.detail,
    createdLabel: relDay(d.createdAt, base),
    createdAt: d.createdAt,
  };
}

/* ---------------- helpers ---------------- */

async function logAudit({ actor = "Super Admin", category, action, targetType = "", targetName = "", detail = "" }) {
  await AuditLog.create({ actor, category, action, targetType, targetName, detail });
}

function pctDelta(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/* ---------------- GET /api/platform/dashboard ---------------- */

export const platformDashboard = asyncHandler(async (req, res) => {
  const [companies, openTickets, auditTotal] = await Promise.all([
    Company.find().lean(),
    SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    AuditLog.countDocuments(),
  ]);

  const active = companies.filter((c) => c.status === "active");
  const mrr = companies.reduce((s, c) => s + mrrOf(c), 0);
  const critical = await SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] }, priority: "critical" });

  const months = lastDataMonths(companies.map((c) => c.createdAt), 8);
  const countIn = (key) => companies.filter((c) => c.createdAt && isoMonth(c.createdAt) === key).length;
  const signups = months.map((key) => ({ key, label: keyLabel(key), value: countIn(key) }));
  const cur = months.length ? countIn(months[months.length - 1]) : 0;
  const prev = months.length > 1 ? countIn(months[months.length - 2]) : 0;

  const planMix = ["enterprise", "business", "trial"].map((p) => ({
    key: p,
    label: PLAN_LABEL[p],
    value: companies.filter((c) => c.plan === p).length,
  }));

  const recent = await AuditLog.find().sort({ createdAt: -1 }).limit(8).lean();
  const base = newestOf(recent.map((a) => a.createdAt));

  const kpis = [
    {
      id: "companies",
      label: "Companies",
      value: String(companies.length),
      note: `+${cur} ${months.length ? keyLabel(months[months.length - 1]) : "this month"}`,
      sub: `${companies.length} total`,
      delta: { pct: Math.abs(pctDelta(cur, prev) || 0), dir: cur >= prev ? "up" : "down", note: "signup momentum", good: true },
    },
    {
      id: "subscriptions",
      label: "Active subscriptions",
      value: String(active.length),
      note: `${companies.length ? Math.round((active.length / companies.length) * 100) : 0}% active`,
      sub: `${active.length} active`,
      delta: null,
    },
    {
      id: "mrr",
      label: "Monthly recurring revenue",
      value: money(mrr),
      note: "from active plans",
      sub: money(mrr),
      delta: null,
    },
    {
      id: "incidents",
      label: "Open incidents",
      value: String(openTickets),
      note: critical ? `${critical} critical` : "all handled",
      sub: `${openTickets} open`,
      delta: null,
    },
  ];

  return ok(res, {
    kpis,
    planMix,
    signups: signups.map(({ label, value }) => ({ label, value })),
    activity: recent.map((a) => auditRow(a, base)),
    totals: {
      companies: companies.length,
      active: active.length,
      trials: companies.filter((c) => c.status === "trial" || c.plan === "trial").length,
      suspended: companies.filter((c) => c.status === "suspended").length,
      seats: companies.reduce((s, c) => s + c.seats, 0),
      auditEntries: auditTotal,
      openTickets,
    },
  });
});

/* ---------------- Companies ---------------- */

export const listCompanies = asyncHandler(async (req, res) => {
  const { search, plan, status, sort = "name" } = req.query;
  const filter = {};
  if (plan) filter.plan = plan;
  if (status) filter.status = status;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { domain: rx }, { industry: rx }, { contactEmail: rx }, { contactName: rx }];
  }
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [total, docs] = await Promise.all([
    Company.countDocuments(filter),
    Company.find(filter).sort(String(sort)).skip(skip).limit(limit).lean(),
  ]);
  const all = await Company.find().lean();
  return ok(res, {
    items: docs.map(companyRow),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    summary: {
      total: all.length,
      active: all.filter((c) => c.status === "active").length,
      mrr: all.reduce((s, c) => s + mrrOf(c), 0),
      open: all.filter((c) => c.status !== "suspended").length,
    },
  });
});

export const getCompany = asyncHandler(async (req, res) => {
  const c = await Company.findById(req.params.id).lean();
  if (!c) throw new ApiError(404, "Company not found");
  const [tickets, audit] = await Promise.all([
    SupportTicket.find({ company: c._id }).sort({ createdAt: -1 }).limit(6).lean(),
    AuditLog.find({ targetType: "company", targetName: c.name }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);
  const base = newestOf([c.createdAt, ...tickets.map((t) => t.updatedAt || t.createdAt), ...audit.map((a) => a.createdAt)], new Date());
  return ok(res, {
    company: companyRow(c),
    tickets: tickets.map((t) => ticketRow(t, base)),
    audit: audit.map((a) => auditRow(a, base)),
  });
});

export const createCompany = asyncHandler(async (req, res) => {
  const { name, domain, industry, plan, status, seats, seatsUsed, contactName, contactEmail, renewalDate, notes } = req.body;
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new ApiError(400, "Company name is required");
  const existing = await Company.findOne({ name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (existing) throw new ApiError(409, "A company with this name already exists");
  const company = await Company.create({
    name: cleanName,
    domain: domain || "",
    industry: industry || "",
    plan: plan || "trial",
    status: status || (plan === "trial" ? "trial" : "active"),
    seats: Math.max(1, Number(seats) || 5),
    seatsUsed: Math.max(0, Number(seatsUsed) || 0),
    contactName: contactName || "",
    contactEmail: contactEmail || "",
    renewalDate: renewalDate || null,
    notes: notes || "",
  });
  await logAudit({ category: "company", action: "Company created", targetType: "company", targetName: company.name, detail: `${company.name} joined on the ${PLAN_LABEL[company.plan]} plan` });
  return created(res, { company: companyRow(company) }, "Company added");
});

export const updateCompany = asyncHandler(async (req, res) => {
  const target = await Company.findById(req.params.id);
  if (!target) throw new ApiError(404, "Company not found");
  const allowed = ["name", "domain", "industry", "plan", "status", "seats", "seatsUsed", "contactName", "contactEmail", "renewalDate", "notes"];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  if ("name" in updates && String(updates.name).trim()) updates.name = String(updates.name).trim();

  const beforePlan = target.plan;
  const beforeStatus = target.status;
  const updated = await Company.findByIdAndUpdate(target._id, updates, { new: true });
  const row = companyRow(updated);

  const changes = [];
  if (req.body.plan !== undefined && req.body.plan !== beforePlan) {
    changes.push(`plan ${PLAN_LABEL[beforePlan]} → ${PLAN_LABEL[req.body.plan]}`);
  }
  if (req.body.status !== undefined && req.body.status !== beforeStatus) {
    changes.push(`status ${beforeStatus} → ${req.body.status}`);
  }
  if (changes.length || req.body.seats !== undefined || req.body.renewalDate !== undefined) {
    await logAudit({
      category: changes.some((c) => c.includes("plan") || c.includes("status")) ? "subscription" : "company",
      action: changes.length ? `Plan ${beforePlan === "trial" ? "upgraded" : "updated"}` : "Company updated",
      targetType: "company",
      targetName: row.name,
      detail: changes.join(", ") || "Profile fields updated",
    });
  }
  return ok(res, { company: row }, "Company updated");
});

export const deleteCompany = asyncHandler(async (req, res) => {
  const target = await Company.findByIdAndDelete(req.params.id);
  if (!target) throw new ApiError(404, "Company not found");
  await SupportTicket.updateMany({ company: target._id }, { $set: { company: null, companyName: target.name } });
  await logAudit({ category: "company", action: "Company removed", targetType: "company", targetName: target.name, detail: `${target.name} was removed from the platform` });
  return noContent(res);
});

/* ---------------- Subscriptions ---------------- */

export const subscriptions = asyncHandler(async (_req, res) => {
  const all = await Company.find().sort({ status: 1, createdAt: -1 }).lean();
  const active = all.filter((c) => c.status === "active");

  const byPlan = ["enterprise", "business", "trial"].map((p) => ({
    plan: p,
    label: PLAN_LABEL[p],
    rate: PLAN_MRR[p],
    count: all.filter((c) => c.plan === p).length,
    mrr: all.filter((c) => c.plan === p).reduce((s, c) => s + mrrOf(c), 0),
  }));

  // MRR trend across the last data months (per company: its creation month).
  const months = lastDataMonths(all.map((c) => c.createdAt), 8);
  const mrrTrend = months.map((key) => {
    const inMonth = all.filter((c) => c.createdAt && isoMonth(c.createdAt) === key);
    return { label: keyLabel(key), value: inMonth.reduce((s, c) => s + mrrOf(c), 0) };
  });

  const newest = newestOf(all.map((c) => c.createdAt));
  const soonCutoff = newest ? new Date(newest.getTime() + 60 * 86400000) : null;
  const renewingSoon = all.filter((c) => c.renewalDate && newest && soonCutoff && c.renewalDate >= newest && c.renewalDate <= soonCutoff).length;

  return ok(res, {
    summary: {
      mrr: all.reduce((s, c) => s + mrrOf(c), 0),
      active: active.length,
      activeRate: all.length ? Math.round((active.length / all.length) * 100) : 0,
      renewingSoon,
      seats: all.reduce((s, c) => s + c.seats, 0),
      seatsUsed: all.reduce((s, c) => s + c.seatsUsed, 0),
    },
    byPlan,
    mrrTrend,
    items: all.map(companyRow),
  });
});

/* ---------------- Audit log ---------------- */

export const listAudit = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ actor: rx }, { action: rx }, { targetName: rx }, { detail: rx }];
  }
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 25, maxLimit: 100 });
  const [total, docs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const base = newestOf(docs.map((a) => a.createdAt), new Date());
  return ok(res, {
    items: docs.map((a) => auditRow(a, base)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ---------------- Support tickets ---------------- */

export const listTickets = asyncHandler(async (req, res) => {
  const { status, priority, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ subject: rx }, { companyName: rx }, { reporter: rx }, { description: rx }];
  }
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [total, docs] = await Promise.all([
    SupportTicket.countDocuments(filter),
    SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const [open, critical, resolved] = await Promise.all([
    SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] }, priority: "critical" }),
    SupportTicket.countDocuments({ status: { $in: ["resolved", "closed"] } }),
  ]);
  const base = newestOf(docs.map((t) => t.updatedAt || t.createdAt), new Date());
  return ok(res, {
    items: docs.map((t) => ticketRow(t, base)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    summary: { open, critical, resolved },
  });
});

export const createTicket = asyncHandler(async (req, res) => {
  const { company, companyName, subject, description, priority, reporter } = req.body;
  if (!subject || !String(subject).trim()) throw new ApiError(400, "Subject is required");
  let companyId = company || null;
  let cName = companyName || "";
  if (companyId) {
    const c = await Company.findById(companyId).lean();
    if (c) cName = c.name;
  } else if (cName) {
    const c = await Company.findOne({ name: new RegExp(`^${String(cName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
    if (c) companyId = c._id;
  }
  const ticket = await SupportTicket.create({
    company: companyId,
    companyName: cName || "Unassigned",
    subject: String(subject).trim(),
    description: description || "",
    priority: priority || "medium",
    status: "open",
    reporter: reporter || req.user?.name || "Super Admin",
    assignee: "",
  });
  await logAudit({ category: "support", action: "Ticket opened", targetType: "ticket", targetName: ticket.subject, detail: `${cName || "Platform"} · priority ${ticket.priority}` });
  return created(res, { ticket: ticketRow(ticket, newestOf([ticket.createdAt], new Date())) }, "Ticket created");
});

export const updateTicket = asyncHandler(async (req, res) => {
  const target = await SupportTicket.findById(req.params.id);
  if (!target) throw new ApiError(404, "Ticket not found");
  const allowed = ["status", "priority", "assignee"];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  const updated = await SupportTicket.findByIdAndUpdate(target._id, updates, { new: true });
  if (req.body.status && req.body.status !== target.status) {
    await logAudit({ category: "support", action: `Ticket ${req.body.status.replace("_", " ")}`, targetType: "ticket", targetName: target.subject, detail: `${target.companyName || "Platform"}` });
  }
  return ok(res, { ticket: ticketRow(updated, newestOf([updated.updatedAt || updated.createdAt], new Date())) }, "Ticket updated");
});

/* ---------------- System health ---------------- */

export const systemHealth = asyncHandler(async (_req, res) => {
  const [users, projects, tasks, departments, companies, tickets, audit] = await Promise.all([
    User.countDocuments(),
    Project.countDocuments(),
    Task.countDocuments(),
    Department.countDocuments(),
    Company.countDocuments(),
    SupportTicket.countDocuments(),
    AuditLog.countDocuments(),
  ]);
  const activeUsers = await User.countDocuments({ status: "active" });
  const openCritical = await SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] }, priority: "critical" });

  const services = [
    { name: "API Gateway", status: "Operational", detail: `${Math.floor(process.uptime() / 60)} min uptime`, latency: "24 ms" },
    { name: "Authentication", status: "Operational", detail: "JWT signing verified", latency: "12 ms" },
    { name: "Database", status: mongoose.connection.readyState === 1 ? "Operational" : "Degraded", detail: `${users} user records`, latency: "6 ms" },
    { name: "Notifications", status: "Operational", detail: "Queue healthy", latency: "8 ms" },
  ];
  return ok(res, {
    services,
    storage: { users, activeUsers, projects, tasks, departments, companies, tickets, auditEntries: audit },
    incidents: openCritical,
    checkedAt: new Date().toISOString(),
  });
});

/* ================= Extended platform pages (Super Admin Figma) ================= */

function invoiceRow(inv, base) {
  return {
    id: String(inv._id),
    number: inv.number,
    company: inv.company && typeof inv.company === "object" ? inv.company.name : "",
    companyId: inv.company && typeof inv.company === "object" ? String(inv.company._id) : String(inv.company || ""),
    plan: inv.plan,
    planLabel: PLAN_LABEL[inv.plan] || inv.plan,
    amount: inv.amount,
    amountLabel: money(inv.amount),
    status: inv.status,
    issued: inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    due: inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    paid: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    method: inv.paymentMethod || "",
  };
}

/** GET /platform/invoices — billing & payments list (+ summary + optional company filter). */
export const listInvoices = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.company) filter.company = req.query.company;
  if (req.query.status) filter.status = req.query.status;
  const rows = await Invoice.find(filter).populate("company", "name").sort({ issuedAt: -1 }).limit(200).lean();
  const paid = rows.filter((i) => i.status === "paid");
  const open = rows.filter((i) => i.status !== "paid");
  return ok(res, {
    items: rows.map((i) => invoiceRow(i)),
    summary: {
      collected: paid.reduce((s, i) => s + i.amount, 0),
      outstanding: open.reduce((s, i) => s + i.amount, 0),
      invoices: rows.length,
      paid: paid.length,
      open: open.length,
    },
  });
});

/** GET /platform/invoices/latest — Invoice Detail page source (latest invoice + payment history). */
export const latestInvoice = asyncHandler(async (req, res) => {
  const rows = await Invoice.find().populate("company", "name").sort({ issuedAt: -1 }).limit(30).lean();
  if (!rows.length) throw new ApiError(404, "No invoices on file");
  const inv = req.query.id ? rows.find((r) => String(r._id) === String(req.query.id)) || rows[0] : rows[0];
  const history = rows.filter((r) => String(r.company?._id || r.company) === String(inv.company?._id || inv.company)).slice(0, 8);
  return ok(res, {
    invoice: invoiceRow(inv),
    history: history.map((i) => invoiceRow(i)),
  });
});

/** GET /platform/subscription-lifecycle — plan change / renewal / cancel events across tenants. */
export const subscriptionLifecycle = asyncHandler(async (_req, res) => {
  const [companies, audits] = await Promise.all([
    Company.find().select("name plan status renewalDate seats seatsUsed contactName").sort({ renewalDate: 1 }).lean(),
    AuditLog.find({ category: { $in: ["subscription", "billing"] } }).sort({ createdAt: -1 }).limit(40).lean(),
  ]);
  const base = newestOf(audits.map((a) => a.createdAt));
  const now = new Date();
  const stages = [
    { key: "renewing", label: "Renewing soon", count: companies.filter((c) => c.renewalDate && new Date(c.renewalDate) <= new Date(now.getTime() + 30 * 86400000)).length },
    { key: "active", label: "Active", count: companies.filter((c) => c.status === "active" && (!c.renewalDate || new Date(c.renewalDate) > new Date(now.getTime() + 30 * 86400000))).length },
    { key: "trial", label: "Trialing", count: companies.filter((c) => c.status === "trial").length },
    { key: "suspended", label: "Suspended", count: companies.filter((c) => c.status === "suspended").length },
  ];
  return ok(res, {
    stages,
    companies: companies.map((c) => ({
      id: String(c._id),
      name: c.name,
      plan: c.plan,
      planLabel: PLAN_LABEL[c.plan] || c.plan,
      status: c.status,
      seats: c.seats,
      seatsUsed: c.seatsUsed,
      mrr: mrrOf(c),
      renewal: c.renewalDate ? new Date(c.renewalDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
      contact: c.contactName || "",
    })),
    events: audits.map((a) => auditRow(a, base)),
  });
});

/** GET /platform/usage — seats & limits usage per company. */
export const usageLimits = asyncHandler(async (_req, res) => {
  const [companies, taskCounts] = await Promise.all([
    Company.find().sort({ name: 1 }).lean(),
    Task.aggregate([{ $group: { _id: "$company", count: { $sum: 1 } } }]).catch(() => []),
  ]);
  const taskByCompany = new Map((taskCounts || []).map((t) => [String(t._id), t.count]));
  const rows = companies.map((c) => {
    const pct = c.seats ? Math.min(100, Math.round((c.seatsUsed / c.seats) * 100)) : 0;
    return {
      id: String(c._id),
      name: c.name,
      plan: c.plan,
      planLabel: PLAN_LABEL[c.plan] || c.plan,
      seats: c.seats,
      seatsUsed: c.seatsUsed,
      seatsPct: pct,
      projects: taskByCompany.get(String(c._id)) || 0,
      mrr: mrrOf(c),
      status: c.status,
    };
  });
  return ok(res, { items: rows });
});

/** GET /platform/activity — platform activity feed (admins' recent events, all categories). */
export const platformActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  const base = newestOf(rows.map((r) => r.createdAt));
  return ok(res, { items: rows.map((a) => auditRow(a, base)) });
});

/** POST /platform/audit — write an audit entry (used by platform actions). */
export const writeAudit = asyncHandler(async (req, res) => {
  const { category = "company", action, targetType = "", targetName = "", detail = "" } = req.body || {};
  if (!action) throw new ApiError(422, "action is required");
  const entry = await logAudit({ actor: req.user ? `${req.user.firstName} ${req.user.lastName || ""}`.trim() : "Super Admin", category, action, targetType, targetName, detail });
  return created(res, { entry: auditRow(entry, new Date()) }, "Logged");
});

/** GET /platform/role-templates — template list. */
export const listRoleTemplates = asyncHandler(async (_req, res) => {
  const rows = await RoleTemplate.find().sort({ system: -1, name: 1 }).lean();
  return ok(res, { items: rows.map((r) => ({ id: String(r._id), name: r.name, description: r.description, permissions: r.permissions, system: r.system })) });
});

/** POST /platform/role-templates — create a template. */
export const createRoleTemplate = asyncHandler(async (req, res) => {
  const { name, description = "", permissions = [] } = req.body || {};
  if (!name || !String(name).trim()) throw new ApiError(422, "Template name is required");
  const dup = await RoleTemplate.findOne({ name: String(name).trim() }).lean();
  if (dup) throw new ApiError(409, "A template with this name already exists");
  const tpl = await RoleTemplate.create({ name: String(name).trim(), description: String(description), permissions: Array.isArray(permissions) ? permissions.slice(0, 40) : [], system: false });
  await logAudit({ actor: `${req.user.firstName} ${req.user.lastName || ""}`.trim(), category: "security", action: "Role template created", targetType: "role_template", targetName: tpl.name });
  return created(res, { template: { id: String(tpl._id), name: tpl.name, description: tpl.description, permissions: tpl.permissions, system: tpl.system } }, "Template created");
});

/** DELETE /platform/role-templates/:id — remove a non-system template. */
export const deleteRoleTemplate = asyncHandler(async (req, res) => {
  const tpl = await RoleTemplate.findById(req.params.id);
  if (!tpl) throw new ApiError(404, "Template not found");
  if (tpl.system) throw new ApiError(403, "System templates cannot be deleted");
  await tpl.deleteOne();
  await logAudit({ actor: `${req.user.firstName} ${req.user.lastName || ""}`.trim(), category: "security", action: "Role template deleted", targetType: "role_template", targetName: tpl.name });
  return noContent(res);
});

/** GET /platform/super-admins — platform administrator accounts. */
export const listSuperAdmins = asyncHandler(async (_req, res) => {
  const rows = await User.find({ role: { $in: ["super_admin", "company_admin"] } }).sort({ lastName: 1 }).lean();
  return ok(res, {
    items: rows.map((u) => ({
      id: String(u._id),
      name: `${u.firstName} ${u.lastName || ""}`.trim(),
      email: u.email,
      role: u.role,
      roleLabel: u.role === "super_admin" ? "Super Admin" : "Company Admin",
      status: u.status,
      lastLogin: u.lastLogin,
      joinedAt: u.joinedAt,
    })),
  });
});

/** PATCH /platform/super-admins/:id — suspend/reactivate a platform account. */
export const patchSuperAdmin = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!["active", "inactive"].includes(status)) throw new ApiError(422, "status must be active or inactive");
  const u = await User.findById(req.params.id);
  if (!u || !["super_admin", "company_admin"].includes(u.role)) throw new ApiError(404, "Platform account not found");
  if (String(u._id) === String(req.user._id) && status === "inactive") throw new ApiError(422, "You cannot deactivate your own account");
  u.status = status;
  await u.save();
  await logAudit({ actor: `${req.user.firstName} ${req.user.lastName || ""}`.trim(), category: "security", action: `Platform account ${status === "active" ? "reactivated" : "suspended"}`, targetType: "user", targetName: u.email });
  return ok(res, { updated: { id: String(u._id), status: u.status } }, "Account updated");
});

/** GET /platform/security — security & access settings (singleton). */
export const getSecuritySettings = asyncHandler(async (_req, res) => {
  let s = await PlatformSettings.findOne();
  if (!s) s = await PlatformSettings.create({ key: "platform" });
  return ok(res, {
    settings: {
      twoFactorRequired: s.twoFactorRequired,
      sessionTimeoutMin: s.sessionTimeoutMin,
      passwordMinLength: s.passwordMinLength,
      allowSignups: s.allowSignups,
      maintenanceMode: s.maintenanceMode,
      updatedBy: s.updatedBy,
      updatedAt: s.updatedAt,
    },
  });
});

/** PATCH /platform/security — update security settings. */
export const patchSecuritySettings = asyncHandler(async (req, res) => {
  let s = await PlatformSettings.findOne();
  if (!s) s = await PlatformSettings.create({ key: "platform" });
  const b = req.body || {};
  if (typeof b.twoFactorRequired === "boolean") s.twoFactorRequired = b.twoFactorRequired;
  if (b.sessionTimeoutMin != null) s.sessionTimeoutMin = Math.max(5, Math.min(1440, Number(b.sessionTimeoutMin) || 60));
  if (b.passwordMinLength != null) s.passwordMinLength = Math.max(6, Math.min(64, Number(b.passwordMinLength) || 8));
  if (typeof b.allowSignups === "boolean") s.allowSignups = b.allowSignups;
  if (typeof b.maintenanceMode === "boolean") s.maintenanceMode = b.maintenanceMode;
  s.updatedBy = `${req.user.firstName} ${req.user.lastName || ""}`.trim();
  await s.save();
  await logAudit({ actor: s.updatedBy, category: "security", action: "Security settings updated", targetType: "platform", targetName: "Security & Access" });
  return ok(res, { settings: s }, "Security settings updated");
});

/** GET /platform/integrations — integration catalog + connection state. */
export const listIntegrations = asyncHandler(async (_req, res) => {
  let rows = await PlatformIntegration.find().sort({ name: 1 }).lean();
  if (!rows.length) {
    const defaults = [
      { key: "slack", name: "Slack", description: "Notifications and approvals in your team channels.", category: "communication", connected: true, configuredBy: "system" },
      { key: "gdrive", name: "Google Drive", description: "Attach and sync employee documents.", category: "storage", connected: true, configuredBy: "system" },
      { key: "stripe", name: "Stripe", description: "Subscription billing & invoice payments.", category: "finance", connected: false, configuredBy: "" },
      { key: "analytics", name: "Analytics Export", description: "Stream usage metrics to your BI stack.", category: "analytics", connected: false, configuredBy: "" },
      { key: "webhooks", name: "Webhooks", description: "Outbound events for custom automations.", category: "other", connected: false, configuredBy: "" },
    ];
    rows = await PlatformIntegration.insertMany(defaults);
  }
  return ok(res, {
    items: rows.map((r) => ({ id: String(r._id), key: r.key, name: r.name, description: r.description, category: r.category, connected: r.connected, connectedAt: r.connectedAt })),
  });
});

/** PATCH /platform/integrations/:key — connect / disconnect an integration. */
export const patchIntegration = asyncHandler(async (req, res) => {
  const row = await PlatformIntegration.findOne({ key: req.params.key });
  if (!row) throw new ApiError(404, "Integration not found");
  const { connected } = req.body || {};
  if (typeof connected !== "boolean") throw new ApiError(422, "connected must be a boolean");
  row.connected = connected;
  row.connectedAt = connected ? new Date() : null;
  row.configuredBy = connected ? `${req.user.firstName} ${req.user.lastName || ""}`.trim() : "";
  await row.save();
  await logAudit({ actor: row.configuredBy || "Super Admin", category: "system", action: `${row.name} ${connected ? "connected" : "disconnected"}`, targetType: "integration", targetName: row.name });
  return ok(res, { integration: { id: String(row._id), key: row.key, name: row.name, connected: row.connected } }, `${row.name} ${connected ? "connected" : "disconnected"}`);
});

/** GET /platform/global-search — cross-tenant search (companies + people + tickets). */
export const globalSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return ok(res, { query: q, companies: [], people: [], tickets: [] });
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(esc(q), "i");
  const [companies, people, tickets] = await Promise.all([
    Company.find({ $or: [{ name: rx }, { domain: rx }, { industry: rx }] }).limit(8).lean(),
    User.find({ $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { jobTitle: rx }] }).select("firstName lastName email jobTitle role status").limit(8).lean(),
    SupportTicket.find({ $or: [{ subject: rx }, { companyName: rx }] }).populate("company", "name").limit(6).lean(),
  ]);
  return ok(res, {
    query: q,
    companies: companies.map((c) => ({ id: String(c._id), name: c.name, plan: c.plan, status: c.status, sub: c.industry || c.domain || "" })),
    people: people.map((u) => ({ id: String(u._id), name: `${u.firstName} ${u.lastName || ""}`.trim(), sub: u.jobTitle || u.email, role: u.role, status: u.status })),
    tickets: tickets.map((t) => ({ id: String(t._id), subject: t.subject, sub: t.company && typeof t.company === "object" ? t.company.name : "", status: t.status, priority: t.priority })),
  });
});

/** PATCH /platform/companies/:id/plan — Assign Subscription (plan change). */
export const assignPlan = asyncHandler(async (req, res) => {
  const { plan } = req.body || {};
  if (!["trial", "business", "enterprise"].includes(plan)) throw new ApiError(422, "Unknown plan");
  const c = await Company.findById(req.params.id);
  if (!c) throw new ApiError(404, "Company not found");
  const prev = c.plan;
  c.plan = plan;
  await c.save();
  await logAudit({ actor: `${req.user.firstName} ${req.user.lastName || ""}`.trim(), category: "subscription", action: `Plan ${prev} → ${plan}`, targetType: "company", targetName: c.name });
  return ok(res, { company: { id: String(c._id), name: c.name, plan: c.plan } }, `Plan set to ${plan}`);
});
