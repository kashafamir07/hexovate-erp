import mongoose from "mongoose";
import { Attendance } from "../models/Attendance.js";
import { Request } from "../models/Request.js";
import { Task } from "../models/Task.js";
import { PerformanceReview } from "../models/PerformanceReview.js";
import { DocumentModel } from "../models/Document.js";
import { Project } from "../models/Project.js";
import { TimeEntry } from "../models/TimeEntry.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { created, noContent, ok } from "../utils/response.js";
import { ApiError } from "../utils/ApiError.js";
import { scopeOf } from "../utils/leader.js";
import { monthKey, startOfMonth, endOfMonth } from "../utils/leader.js";
import * as an from "../services/analytics.service.js";

const DAY = 86400000;

const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /hr/people — scoped employee list with today's status + performance. */
export const hrPeopleList = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const { search, department, status, designation, employmentType } = req.query;

  const scopeIds = scope.userIds;
  const all = await an.orgUsers();
  let users = all.filter((u) => scopeIds.some((id) => String(id) === String(u._id)));

  const byRole = (designation) => {
    const map = { Employee: "employee", Manager: "manager", Executive: "executive", HR: "hr", Admin: "admin", CEO: "ceo", "Company Admin": "company_admin", "Super Admin": "super_admin" };
    return map[String(designation)] || null;
  };
  if (designation) {
    const role = byRole(designation);
    if (role) users = users.filter((u) => u.role === role);
    else {
      const rx = new RegExp(esc(designation), "i");
      users = users.filter((u) => rx.test(u.jobTitle || ""));
    }
  }
  if (department) users = users.filter((u) => String(u.department || "") === String(department));
  if (employmentType) users = users.filter((u) => (u.employmentType || "full_time") === employmentType);
  if (status) users = users.filter((u) => u.status === status);
  if (search) {
    const rx = new RegExp(esc(search), "i");
    users = users.filter((u) => rx.test(`${u.firstName} ${u.lastName || ""} ${u.jobTitle || ""} ${u.email || ""} ${u.employeeId || ""}`));
  }
  users.sort((a, b) => a.firstName.localeCompare(b.firstName));

  const total = users.length;
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 100, maxLimit: 200 });
  const slice = users.slice(skip, skip + limit);
  const ids = slice.map((u) => u._id);

  const [today, onLeave, perf, tasks] = await Promise.all([
    an.attendanceToday(ids),
    an.onLeaveToday(ids),
    an.perfSnapshot(ids),
    an.taskSnapshot(ids),
  ]);
  const statusLabel = { present: "Present", late: "Late", absent: "Absent", leave: "On leave", half_day: "Half day" };
  const onLeaveIds = new Set(onLeave.map((o) => o.id));

  const items = slice.map((u) => {
    const uid = String(u._id);
    const rec = today.byUser.get(uid);
    const open = tasks.openByUser.get(uid) || 0;
    const mgr = u.manager ? users.find((x) => String(x._id) === String(u.manager)) : null;
    return {
      ...an.personRow(u),
      managerName: mgr ? `${mgr.firstName} ${mgr.lastName || ""}`.trim() : "",
      today: onLeaveIds.has(uid) ? "On leave" : statusLabel[rec?.status || "absent"],
      score: perf.byUser.get(uid)?.score ?? null,
      openTasks: open,
    };
  });

  const deptSet = new Map();
  for (const u of all) {
    if (!scopeIds.some((id) => String(id) === String(u._id))) continue;
    if (u.department && u.departmentName) deptSet.set(String(u.department), u.departmentName);
  }
  const departments = [...deptSet.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const designations = [...new Set(users.map((u) => u.role))].filter(Boolean);
  const roleLabel = { employee: "Employee", manager: "Manager", executive: "Executive", hr: "HR", admin: "Admin", ceo: "CEO", company_admin: "Company Admin", super_admin: "Super Admin" };

  return ok(res, {
    scope: { type: scope.type, name: scope.name, memberCount: scopeIds.length },
    items,
    total,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    filters: { departments, designations: designations.map((r) => roleLabel[r] || r) },
  });
});

const idInScope = (scope, id) => scope.userIds.some((x) => String(x) === String(id));

/** GET /hr/people/:id — employee profile + analytics for a leader. */
export const hrPeopleDetail = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  if (!idInScope(scope, req.params.id)) throw new ApiError(403, "This employee is not in your scope");
  const users = await an.orgUsers();
  const u = users.find((x) => String(x._id) === String(req.params.id));
  if (!u) throw new ApiError(404, "Employee not found");

  const manager = u.manager ? await User.findById(u.manager).select("firstName lastName jobTitle").lean() : null;
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const [recordsMonth, allRecords, reviews, leaves, openTasks, doneTasks, empProjects, docCount] = await Promise.all([
    Attendance.find({ user: u._id, date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 1 }).lean(),
    Attendance.find({ user: u._id }).sort({ date: -1 }).limit(45).lean(),
    PerformanceReview.find({ user: u._id }).populate("reviewer", "firstName lastName").sort({ period: -1, createdAt: -1 }).lean(),
    Request.find({ requester: u._id, type: "leave", status: "approved" }).lean(),
    Task.find({ assignedTo: u._id, status: { $ne: "completed" } }).populate("project", "name").sort({ dueDate: 1 }).lean(),
    Task.countDocuments({ assignedTo: u._id, status: "completed" }),
    Project.find({ members: u._id }).select("name status progress").lean(),
    DocumentModel.countDocuments({ employee: u._id }),
  ]);

  const monthly = an.monthlyAttendance(recordsMonth, 1)[0];
  const perfLatest = reviews.find((r) => r.status === "completed") || null;
  const monthAgo = new Date(Date.now() - 30 * DAY);
  const leaveMonth = leaves.filter((l) => l.startDate && new Date(l.startDate) >= monthAgo);
  const leaveDaysUsed = leaves.reduce((s, l) => s + an.leaveDays(l), 0);

  return ok(res, {
    profile: {
      ...an.personRow(u),
      departmentName: u.departmentName,
      managerName: manager ? `${manager.firstName} ${manager.lastName || ""}`.trim() : "",
      managerJobTitle: manager?.jobTitle || "",
      location: u.location,
      phone: u.phone,
      email: u.email,
    },
    metrics: {
      attendanceMonth: monthly ? { rate: monthly.rate, present: monthly.present, late: monthly.late, absent: monthly.absent } : { rate: null, present: 0, late: 0, absent: 0 },
      perfLatest: perfLatest
        ? { period: perfLatest.period, score: perfLatest.score, rating: perfLatest.rating, status: perfLatest.status, reviewDate: perfLatest.reviewDate, feedback: perfLatest.feedback, goals: perfLatest.goals || [], reviewer: perfLatest.reviewer ? `${perfLatest.reviewer.firstName} ${perfLatest.reviewer.lastName || ""}`.trim() : "" }
        : null,
      reviews: reviews.map((r) => ({ id: String(r._id), period: r.period, score: r.score, rating: r.rating, status: r.status, reviewDate: r.reviewDate, reviewer: r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName || ""}`.trim() : "" })),
      leaveUsedMonth: leaveMonth.reduce((s, l) => s + an.leaveDays(l), 0),
      leaveDaysUsed,
      leaveBalance: u.leaveBalanceDays ?? 14,
      openTasks: openTasks.length,
      completedTasks: doneTasks,
    },
    tasks: openTasks.map((t) => ({ id: String(t._id), title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, project: t.project && typeof t.project === "object" ? t.project.name : "" })),
    projects: empProjects.map((p) => ({ id: String(p._id), name: p.name, status: p.status, progress: p.progress })),
    docCount,
    history: allRecords.map((r) => ({
      id: String(r._id), date: r.date, status: r.status, clockIn: r.clockIn, clockOut: r.clockOut, hours: r.hours,
    })),
  });
});

/* ---------------- employee profile tabs (Figma "People / Priya Nandan") ---------------- */

const MONTH_DAY = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

/** Documents tab rows for the profile drawer/page (leader-scope read; HR/admins can upload). */
export const personDocuments = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  if (!scope.userIds.some((x) => String(x) === String(req.params.id))) throw new ApiError(403, "This employee is not in your scope");
  const docs = await DocumentModel.find({ employee: req.params.id }).populate("uploadedBy", "firstName lastName").sort({ uploadedAt: -1 }).limit(100).lean();
  return ok(res, {
    documents: docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      fileName: d.fileName || `${d.title}.pdf`,
      category: d.category,
      uploadedAt: d.uploadedAt,
      uploadedLabel: MONTH_DAY(d.uploadedAt),
      uploadedBy: d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName || ""}`.trim() : "",
    })),
  });
});

/** Time Logs tab — recent time entries for one employee. */
export const personTimeLogs = asyncHandler(async (req, res) => {
  const scope = await scopeOf(req.user);
  if (!scope.userIds.some((x) => String(x) === String(req.params.id))) throw new ApiError(403, "This employee is not in your scope");
  const entries = await TimeEntry.find({ user: req.params.id, status: "stopped" }).sort({ date: -1 }).limit(60).lean();
  return ok(res, {
    logs: entries.map((t) => ({
      id: String(t._id),
      date: t.date,
      project: t.projectName || "—",
      task: t.taskName || t.description || "—",
      hours: Math.round(((t.duration || 0) / 60) * 10) / 10,
    })),
  });
});

/** Leave History tab — all leave requests of one employee. */
export const personLeaveHistory = asyncHandler(async (req, res) => {
  const scope = await scopeOf(req.user);
  if (!scope.userIds.some((x) => String(x) === String(req.params.id))) throw new ApiError(403, "This employee is not in your scope");
  const rows = await Request.find({ requester: req.params.id, type: "leave" }).sort({ startDate: -1 }).limit(60).lean();
  return ok(res, {
    items: rows.map((r) => ({
      id: String(r._id),
      kind: an.leaveTypeLabel(r.type === "leave" ? "leave" : r.type),
      from: MONTH_DAY(r.startDate),
      to: MONTH_DAY(r.endDate),
      days: an.leaveDays(r),
      status: r.status,
      note: r.response || "",
    })),
  });
});

/* ---------------- document upload / delete (HR + admins) ---------------- */

const DOC_CATEGORIES = ["contract", "id", "review", "tax", "other"];

/** POST /hr/people/:id/documents — file a document row (HR/admins/company admins only). */
export const personDocumentCreate = asyncHandler(async (req, res) => {
  const actor = req.user;
  if (!["hr", "admin", "company_admin", "super_admin"].includes(actor.role)) {
    throw new ApiError(403, "Only HR and admins can upload employee documents");
  }
  const { title, fileName = "", category = "other" } = req.body || {};
  if (!title || !String(title).trim()) throw new ApiError(422, "Document title is required");
  if (!DOC_CATEGORIES.includes(category)) throw new ApiError(422, "Unknown document category");
  const target = await User.findById(req.params.id).select("_id").lean();
  if (!target) throw new ApiError(404, "Employee not found");
  const doc = await DocumentModel.create({
    employee: req.params.id,
    title: String(title).trim().slice(0, 160),
    fileName: String(fileName).trim().slice(0, 200) || `${String(title).trim()}.pdf`,
    category,
    uploadedBy: actor._id,
  });
  return created(res, {
    document: {
      id: String(doc._id),
      title: doc.title,
      fileName: doc.fileName,
      category: doc.category,
      uploadedLabel: MONTH_DAY(doc.uploadedAt),
      uploadedBy: `${actor.firstName} ${actor.lastName || ""}`.trim(),
    },
  }, "Document uploaded");
});

/** DELETE /hr/people/:id/documents/:docId — remove a filed document (HR/admins only). */
export const personDocumentDelete = asyncHandler(async (req, res) => {
  const actor = req.user;
  if (!["hr", "admin", "company_admin", "super_admin"].includes(actor.role)) {
    throw new ApiError(403, "Only HR and admins can remove employee documents");
  }
  const doc = await DocumentModel.findOne({ _id: req.params.docId, employee: req.params.id });
  if (!doc) throw new ApiError(404, "Document not found");
  await doc.deleteOne();
  return noContent(res);
});
