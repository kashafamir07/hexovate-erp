import { Task } from "../models/Task.js";
import { Request } from "../models/Request.js";
import { Department } from "../models/Department.js";
import { JobPosting } from "../models/JobPosting.js";
import { TimeEntry } from "../models/TimeEntry.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, noContent, ok } from "../utils/response.js";
import { assignableIds, scopeOf, monthKey } from "../utils/leader.js";
import { durLabel, relTime } from "../utils/ui.js";
import { notifyTaskAssignment } from "../services/notification.service.js";
import * as an from "../services/analytics.service.js";

const TASK_POP = [
  { path: "project", select: "name" },
  { path: "assignedTo", select: "firstName lastName jobTitle department" },
];
const REQ_POP = [
  { path: "requester", select: "firstName lastName jobTitle department manager" },
  { path: "reviewer", select: "firstName lastName" },
];
const REQ_STATUS_UI = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };
const REQ_KIND_UI = { leave: "Leave", permission: "Permission", equipment: "Equipment", expense: "Expense", other: "Other" };
const STATUS_UI = { todo: "To Do", in_progress: "In Progress", review: "In Review", completed: "Done" };
const PRIORITY_UI = { low: "Low", medium: "Medium", high: "High" };
const parseStatus = (s) => ({ "To Do": "todo", "In Progress": "in_progress", "In Review": "review", Done: "completed", todo: "todo", in_progress: "in_progress", review: "review", completed: "completed" }[s] || s);
const parsePriority = (p) => ({ Low: "low", Medium: "medium", High: "high", low: "low", medium: "medium", high: "high" }[p] || p);
const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function leaderGuard(actor) {
  if (!["manager", "hr", "admin", "company_admin", "super_admin", "ceo"].includes(actor.role)) throw new ApiError(403, "This feature is for team leaders only");
}

/** GET /hr/team-tasks — tasks assigned to the leader's people. */
export const hrTeamTasks = asyncHandler(async (req, res) => {
  const actor = req.user;
  await leaderGuard(actor);
  const scope = await scopeOf(actor);
  const { status, priority, employee, search, due } = req.query;
  const filter = { assignedTo: { $in: scope.userIds } };
  if (status) filter.status = parseStatus(status);
  if (priority) filter.priority = parsePriority(priority);
  if (employee) filter.assignedTo = employee;
  if (due === "today") {
    const d = new Date();
    filter.dueDate = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
  }
  if (due === "overdue") filter.dueDate = { $lt: new Date() };
  if (search) {
    const rx = new RegExp(esc(search), "i");
    filter.$or = [{ title: rx }, { description: rx }];
  }
  const tasks = await Task.find(filter).populate(TASK_POP).sort({ dueDate: 1, createdAt: -1 }).limit(300).lean();
  const users = await an.orgUsers();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const rows = tasks.map((t) => {
    const assignee = t.assignedTo && typeof t.assignedTo === "object" ? t.assignedTo : null;
    const person = an.personRow(assignee || { _id: t.assignedTo });
    return {
      id: String(t._id),
      title: t.title || "",
      status: t.status,
      statusLabel: STATUS_UI[t.status] || t.status,
      priority: PRIORITY_UI[t.priority] || "Medium",
      priorityKey: t.priority,
      project: t.project && typeof t.project === "object" ? t.project.name : "",
      dueDate: t.dueDate || null,
      due: t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      assignee: { ...person, departmentName: person.departmentName || (assignee && assignee.department && byId.get(String(assignee.department))) },
    };
  });
  const statusCounts = { todo: 0, in_progress: 0, review: 0, completed: 0 };
  for (const t of tasks) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  return ok(res, { scope: { type: scope.type, name: scope.name }, statusCounts, open: tasks.filter((t) => t.status !== "completed").length, items: rows });
});

/** POST /hr/team-tasks — create + assign (assignment restricted to the leader's people). */
export const hrCreateTask = asyncHandler(async (req, res) => {
  const actor = req.user;
  await leaderGuard(actor);
  const { title, description, assignedTo, priority, dueDate, labels, project } = req.body;
  if (!title || !String(title).trim()) throw new ApiError(422, "Title is required", [{ field: "title", msg: "Title is required" }]);
  const assignees = await assignableIds(actor);
  let target = assignedTo || actor._id;
  if (!assignees.some((id) => String(id) === String(target))) throw new ApiError(403, "You can only assign tasks to people in your scope");
  const task = await Task.create({
    title: String(title).trim(),
    description: description || "",
    project: project || null,
    assignedTo: target,
    createdBy: actor._id,
    priority: parsePriority(priority) || "medium",
    dueDate: dueDate || null,
    labels: labels || [],
    status: "todo",
  });
  if (String(target) !== String(actor._id)) await notifyTaskAssignment(target, task.title, `${actor.firstName} ${actor.lastName}`);
  const full = await Task.findById(task._id).populate(TASK_POP).lean();
  return created(res, { task: taskRow(full) }, "Task assigned");
});

function taskRow(t) {
  const assignee = t.assignedTo && typeof t.assignedTo === "object" ? t.assignedTo : null;
  return {
    id: String(t._id),
    title: t.title || "",
    status: t.status,
    statusLabel: STATUS_UI[t.status] || t.status,
    priority: PRIORITY_UI[t.priority] || "Medium",
    project: t.project && typeof t.project === "object" ? t.project.name : "",
    dueDate: t.dueDate || null,
    due: t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
    assignee: assignee ? an.personRow(assignee) : null,
  };
}

async function loadScopedTask(actor, id) {
  const scope = await scopeOf(actor);
  const task = await Task.findById(id).populate(TASK_POP);
  if (!task) throw new ApiError(404, "Task not found");
  const assigneeId = String(task.assignedTo?._id || task.assignedTo || "");
  const mine = String(task.createdBy || "") === String(actor._id);
  if (!scope.userIds.some((x) => String(x) === assigneeId) && !mine && !["admin", "hr", "company_admin", "super_admin"].includes(actor.role)) {
    throw new ApiError(403, "This task is not in your scope");
  }
  return task;
}

/** PATCH /hr/team-tasks/:id */
export const hrUpdateTask = asyncHandler(async (req, res) => {
  const actor = req.user;
  await leaderGuard(actor);
  const task = await loadScopedTask(actor, req.params.id);
  const { title, description, status, priority, dueDate, assignedTo } = req.body;
  if (title !== undefined) task.title = String(title).trim() || task.title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) {
    const next = parseStatus(status);
    if (!["todo", "in_progress", "review", "completed"].includes(next)) throw new ApiError(422, "Unknown status", [{ field: "status", msg: "Unknown status" }]);
    task.status = next;
    task.completedAt = next === "completed" ? new Date() : null;
  }
  if (priority !== undefined) task.priority = parsePriority(priority) || task.priority;
  if (dueDate !== undefined) task.dueDate = dueDate || null;
  if (assignedTo !== undefined && String(assignedTo) !== String(task.assignedTo?._id || task.assignedTo)) {
    const assignees = await assignableIds(actor);
    if (!assignees.some((id) => String(id) === String(assignedTo))) throw new ApiError(403, "You can only assign tasks to people in your scope");
    task.assignedTo = assignedTo;
    await notifyTaskAssignment(assignedTo, task.title, `${actor.firstName} ${actor.lastName}`);
  }
  await task.save();
  const full = await Task.findById(task._id).populate(TASK_POP).lean();
  return ok(res, { task: taskRow(full) }, "Task updated");
});

/** DELETE /hr/team-tasks/:id */
export const hrDeleteTask = asyncHandler(async (req, res) => {
  const actor = req.user;
  await leaderGuard(actor);
  await loadScopedTask(actor, req.params.id);
  await Task.findByIdAndDelete(req.params.id);
  return noContent(res);
});

/** GET /hr/team-tasks/stats — status counts, per-employee load, completion trend. */
export const hrTaskStats = asyncHandler(async (req, res) => {
  const actor = req.user;
  await leaderGuard(actor);
  const scope = await scopeOf(actor);
  const snapshot = await an.taskSnapshot(scope.userIds);
  const users = await an.orgUsers();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const now = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i -= 1) keys.push(`${now.getFullYear()}-${String(now.getMonth() + 1 - i).padStart(2, "0")}`);
  const completion = keys.map((key) => ({ label: new Date(`${key}-15T12:00:00`).toLocaleDateString("en-US", { month: "short" }), value: snapshot.doneByMonth.get(key) || 0 }));
  const doneByUser = new Map();
  for (const t of snapshot.tasks) if (t.status === "completed") doneByUser.set(String(t.assignedTo), (doneByUser.get(String(t.assignedTo)) || 0) + 1);
  const perEmployee = scope.userIds
    .map((id) => {
      const u = byId.get(String(id));
      if (!u) return null;
      return {
        ...an.personRow(u),
        open: snapshot.openByUser.get(String(id)) || 0,
        done: doneByUser.get(String(id)) || 0,
      };
    })
    .filter(Boolean);
  return ok(res, { statusCounts: snapshot.statusCounts, open: snapshot.tasks.filter((t) => t.status !== "completed").length, completion, perEmployee });
});

/* ---------------- leaves & approvals (scoped, requester-aware) ---------------- */

/** GET /hr/leaves?type=leave&includeAll=1&status=&employee=&from=&to= — leader-scoped list + summary. */
export const hrLeavesList = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const { status, employee, from, to, includeAll, type, search } = req.query;
  const filter = { requester: { $in: scope.userIds } };
  if (!includeAll) filter.type = type || "leave";
  if (status) filter.status = status;
  if (employee) filter.requester = employee;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { description: rx }];
  }
  const range = [];
  if (from) range.push({ startDate: { $gte: new Date(`${String(from)}T00:00:00`) } });
  if (to) range.push({ startDate: { $lte: new Date(`${String(to)}T23:59:59`) } });
  if (range.length) filter.$and = range;

  const [docs, users] = await Promise.all([
    Request.find(filter).populate(REQ_POP).sort({ createdAt: -1 }).limit(300).lean(),
    an.orgUsers(),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const items = docs.map((r) => {
    const u = r.requester && typeof r.requester === "object" ? r.requester : null;
    const reviewer = r.reviewer && typeof r.reviewer === "object" ? r.reviewer : null;
    return {
      id: String(r._id),
      type: r.type,
      kind: REQ_KIND_UI[r.type] || r.type,
      title: r.title || "",
      description: r.description || "",
      amount: r.amount ?? null,
      startDate: r.startDate || null,
      endDate: r.endDate || null,
      startLabel: r.startDate ? new Date(r.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      endLabel: r.endDate ? new Date(r.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      days: r.startDate ? an.leaveDays(r) : null,
      status: r.status,
      statusLabel: REQ_STATUS_UI[r.status] || r.status,
      requester: u ? { ...an.personRow(u), departmentName: (u.department && byId.get(String(u._id))?.departmentName) || "" } : null,
      reviewer: reviewer ? `${reviewer.firstName} ${reviewer.lastName || ""}`.trim() : "",
      note: r.response || "",
      submittedLabel: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    };
  });

  const pending = items.filter((i) => i.status === "pending");
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const daysThisMonth = items
    .filter((i) => i.status === "approved" && i.startDate && new Date(i.startDate) >= monthAgo)
    .reduce((s, i) => s + (i.days || 0), 0);
  const onLeave = await an.onLeaveToday(scope.userIds);
  return ok(res, {
    scope: { type: scope.type, name: scope.name },
    summary: { pending: pending.length, daysThisMonth, onLeaveNow: onLeave.length, total: items.length },
    items,
  });
});

/* ---------------- activity monitoring ---------------- */

/** GET /hr/team-activity — recent task / request / time activity for the leader's scope. */
export const hrTeamActivity = asyncHandler(async (req, res) => {
  const actor = req.user;
  await leaderGuard(actor);
  const scope = await scopeOf(actor);
  const ids = scope.userIds;
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86400000);

  const [tasks, requests, timeEntries] = await Promise.all([
    Task.find({ assignedTo: { $in: ids }, createdAt: { $gte: since } }).populate("assignedTo", "firstName lastName jobTitle").sort({ createdAt: -1 }).limit(40).lean(),
    Request.find({ requester: { $in: ids }, createdAt: { $gte: since } }).populate("requester", "firstName lastName jobTitle").sort({ createdAt: -1 }).limit(40).lean(),
    TimeEntry.find({ user: { $in: ids }, createdAt: { $gte: since } }).populate("user", "firstName lastName jobTitle").sort({ createdAt: -1 }).limit(40).lean(),
  ]);

  const feed = [];
  for (const t of tasks) {
    const who = t.assignedTo && typeof t.assignedTo === "object" ? an.personRow(t.assignedTo) : null;
    if (!who) continue;
    const done = t.status === "completed" && t.completedAt;
    feed.push({
      id: `t-${String(t._id)}`,
      type: "task",
      ts: done && t.completedAt >= since ? t.completedAt : t.createdAt,
      person: who,
      text: `${who.name} ${done ? "completed task" : "updated task"} “${t.title || ""}”`,
    });
  }
  for (const r of requests) {
    const who = r.requester && typeof r.requester === "object" ? an.personRow(r.requester) : null;
    if (!who) continue;
    feed.push({
      id: `r-${String(r._id)}`,
      type: "request",
      ts: r.createdAt,
      person: who,
      text: `${who.name} submitted ${r.type === "leave" ? "a leave request" : `a ${an.leaveTypeLabel(r.type).toLowerCase()} request`} — ${r.status}`,
    });
  }
  for (const e of timeEntries) {
    const who = e.user && typeof e.user === "object" ? an.personRow(e.user) : null;
    if (!who) continue;
    feed.push({
      id: `e-${String(e._id)}`,
      type: "time",
      ts: e.createdAt || e.date,
      person: who,
      text: `${who.name} logged ${durLabel(e.duration || 0)} on ${e.projectName || "work"}`,
    });
  }

  feed.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const items = feed.slice(0, 60).map((f) => ({
    id: f.id,
    type: f.type,
    initials: f.person.initials,
    color: f.person.color,
    name: f.person.name,
    jobTitle: f.person.jobTitle || "",
    text: f.text,
    time: relTime(f.ts, now),
  }));
  return ok(res, { items, total: items.length });
});

/* ---------------- calendar ---------------- */

/** GET /hr/calendar?month=YYYY-MM — leaves, task deadlines & work anniversaries for the scope. */
export const hrCalendar = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const now = new Date();
  const y = Number(req.query.year) || now.getFullYear();
  const m = Number(req.query.month) || now.getMonth() + 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const [leaves, tasks, users] = await Promise.all([
    Request.find({ requester: { $in: scope.userIds }, type: "leave", status: { $in: ["approved", "pending"] }, startDate: { $lte: end }, endDate: { $gte: start } })
      .populate("requester", "firstName lastName")
      .lean(),
    Task.find({ assignedTo: { $in: scope.userIds }, dueDate: { $gte: start, $lte: end }, status: { $ne: "completed" } })
      .populate("assignedTo", "firstName lastName")
      .populate("project", "name")
      .lean(),
    an.orgUsers(),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const events = [];
  for (const l of leaves) {
    const from = dayStart(l.startDate);
    const to = dayStart(l.endDate || l.startDate);
    const name = l.requester && typeof l.requester === "object" ? `${l.requester.firstName} ${l.requester.lastName || ""}`.trim() : "Employee";
    const days = Math.round((to - from) / 86400000) + 1;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d < start || d > end) continue;
      events.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, type: l.status === "pending" ? "leave-pending" : "leave", title: `Leave — ${name}`, meta: `${days} day${days > 1 ? "s" : ""}${l.title ? ` · ${l.title}` : ""}` });
    }
  }
  for (const t of tasks) {
    const d = dayStart(t.dueDate);
    const name = t.assignedTo && typeof t.assignedTo === "object" ? `${t.assignedTo.firstName} ${t.assignedTo.lastName || ""}`.trim() : "Unassigned";
    const proj = t.project && typeof t.project === "object" ? t.project.name : "";
    events.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, type: "task", title: t.title, meta: `${name}${proj ? ` · ${proj}` : ""}` });
  }
  for (const u of scope.userIds) {
    const person = byId.get(String(u));
    if (!person || !person.joinedAt) continue;
    const joined = new Date(person.joinedAt);
    if (joined.getMonth() !== m - 1) continue;
    const years = y - joined.getFullYear();
    if (years <= 0) continue;
    const d = Math.min(joined.getDate(), new Date(y, m, 0).getDate());
    events.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, type: "milestone", title: `${years} year${years > 1 ? "s" : ""} at Hexovate`, meta: `${person.firstName} ${person.lastName || ""}`.trim() });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  const days = [];
  let cursor = 0;
  while (cursor < events.length) {
    const date = events[cursor].date;
    const group = [];
    while (cursor < events.length && events[cursor].date === date) {
      group.push(events[cursor]);
      cursor += 1;
    }
    const dt = new Date(`${date}T12:00:00`);
    days.push({ date, label: dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), items: group });
  }
  return ok(res, {
    month: `${y}-${String(m).padStart(2, "0")}`,
    monthLabel: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    counts: { leaves: leaves.length, tasks: tasks.length },
    days,
  });
});

/* ---------------- reports ---------------- */

const ORG_TYPES = ["headcount", "payroll", "recruitment", "dept"];
const LEADER_TYPES = ["attendance", "leave", "performance", "task"];

/** GET /hr/reports?type=&from=&to=&dept=&employee=&month= */
export const hrReports = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { type, from, to, dept, employee, month } = req.query;
  const scope = await scopeOf(actor);
  const isOrgScope = scope.type === "org";
  if (ORG_TYPES.includes(type) && !isOrgScope) throw new ApiError(403, "This report requires executive-level access");
  if (![...ORG_TYPES, ...LEADER_TYPES].includes(type)) throw new ApiError(422, "Unknown report type", [{ field: "type", msg: "Unknown report type" }]);

  const users = await an.orgUsers();
  let scopedUsers = users.filter((u) => scope.userIds.some((id) => String(id) === String(u._id)));
  if (dept) scopedUsers = scopedUsers.filter((u) => String(u.department || "") === String(dept));
  if (employee) {
    if (!scope.userIds.some((id) => String(id) === String(employee))) throw new ApiError(403, "That employee is outside your scope");
    scopedUsers = scopedUsers.filter((u) => String(u._id) === String(employee));
  }
  const now = new Date();
  const fromDate = from ? new Date(`${String(from)}T00:00:00`) : new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const toDate = to ? new Date(`${String(to)}T23:59:59`) : now;
  const titleByType = { attendance: "Attendance Report", leave: "Leave Report", performance: "Performance Report", task: "Team Task Report", headcount: "Headcount Report", payroll: "Payroll Report", recruitment: "Recruitment Report", dept: "Department Comparison Report" };
  const title = titleByType[type] || "Report";
  const subtitle = fromDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " – " + toDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let columns = [];
  let rows = [];

  if (type === "attendance") {
    const records = await an.attendanceRecords(scopedUsers.map((u) => u._id), fromDate, toDate);
    const per = new Map(scopedUsers.map((u) => [String(u._id), { present: 0, late: 0, absent: 0, leave: 0 }]));
    for (const r of records) {
      const b = per.get(String(r.user));
      if (b && b[r.status] !== undefined) b[r.status] += 1;
    }
    columns = ["Employee", "Department", "Present", "Late", "Absent", "On leave", "Attendance %"];
    rows = scopedUsers.map((u) => {
      const b = per.get(String(u._id)) || { present: 0, late: 0, absent: 0, leave: 0 };
      const denom = b.present + b.late + b.absent;
      return [nameOf(u), u.departmentName, String(b.present), String(b.late), String(b.absent), String(b.leave), denom ? `${Math.round(((b.present + b.late) / denom) * 1000) / 10}%` : "—"];
    });
  } else if (type === "leave") {
    const leaves = await an.leaveRequests(scopedUsers.map((u) => u._id), { from: fromDate, to: toDate });
    columns = ["Employee", "Department", "Type", "Start", "End", "Days", "Status"];
    rows = leaves.map((l) => {
      const u = l.requester && typeof l.requester === "object" ? l.requester : null;
      return [
        u ? `${u.firstName} ${u.lastName || ""}`.trim() : "—",
        u?.department ? users.find((x) => String(x._id) === String(u.department))?.name || "" : "",
        l.title || "Leave",
        l.startDate ? new Date(l.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
        l.endDate ? new Date(l.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
        String(an.leaveDays(l)),
        String(l.status),
      ];
    });
  } else if (type === "performance") {
    const reviews = await an.performanceReviews(scopedUsers.map((u) => u._id));
    columns = ["Employee", "Department", "Period", "Score", "Rating", "Status", "Reviewer"];
    rows = reviews.map((r) => {
      const u = r.user && typeof r.user === "object" ? r.user : null;
      const reviewer = r.reviewer && typeof r.reviewer === "object" ? r.reviewer : null;
      return [
        u ? `${u.firstName} ${u.lastName || ""}`.trim() : "—",
        u?.department ? users.find((x) => String(x._id) === String(u.department))?.name || "" : "",
        String(r.period || ""),
        String(r.score ?? "—"),
        r.rating || an.ratingOf(r.score),
        String(r.status),
        reviewer ? `${reviewer.firstName} ${reviewer.lastName || ""}`.trim() : "—",
      ];
    });
  } else if (type === "task") {
    const tasks = await Task.find({ assignedTo: { $in: scopedUsers.map((u) => u._id) } }).lean();
    const per = new Map(scopedUsers.map((u) => [String(u._id), { todo: 0, in_progress: 0, review: 0, completed: 0, total: 0 }]));
    for (const t of tasks) {
      const b = per.get(String(t.assignedTo));
      if (b) { b[t.status] = (b[t.status] || 0) + 1; b.total += 1; }
    }
    columns = ["Employee", "Department", "To do", "In progress", "In review", "Done", "Total"];
    rows = scopedUsers.map((u) => {
      const b = per.get(String(u._id)) || { todo: 0, in_progress: 0, review: 0, completed: 0, total: 0 };
      return [nameOf(u), u.departmentName, String(b.todo), String(b.in_progress), String(b.review), String(b.completed), String(b.total)];
    });
  } else if (type === "headcount") {
    const series = an.orgHeadcountSeries(users, 8);
    columns = ["Month", "Active headcount"];
    rows = series.map((p) => [p.label, String(p.value)]);
  } else if (type === "payroll") {
    const target = month || monthKey(now);
    const records = await an.payrollRecords(target);
    columns = ["Employee", "Department", "Base", "Allowances", "Deductions", "Net", "Status"];
    rows = records.map((r) => {
      const u = r.user && typeof r.user === "object" ? r.user : null;
      return [
        u ? `${u.firstName} ${u.lastName || ""}`.trim() : "—",
        u?.department ? users.find((x) => String(x._id) === String(u.department))?.name || "" : "",
        `$${Math.round(r.base).toLocaleString()}`,
        `$${Math.round(r.allowances).toLocaleString()}`,
        `$${Math.round(r.deductions).toLocaleString()}`,
        `$${Math.round(r.net).toLocaleString()}`,
        String(r.status),
      ];
    });
  } else if (type === "recruitment") {
    const jobs = await JobPosting.find({}).populate("department", "name").lean();
    columns = ["Position", "Department", "Status", "Openings", "Applicants", "Hired"];
    rows = jobs.map((j) => [
      j.title,
      j.department && typeof j.department === "object" ? j.department.name : j.departmentName || "",
      String(j.status),
      String(j.openings || 1),
      String(j.applicants || 0),
      String(j.hired || 0),
    ]);
  } else if (type === "dept") {
    const departments = await Department.find({}).select("name").lean();
    const monthRecords = await an.attendanceRecords(scopedUsers.map((u) => u._id), new Date(now.getFullYear(), now.getMonth(), 1), now);
    const monthly = an.monthlyAttendance(monthRecords, 1);
    const rate = monthly[0]?.rate ?? null;
    columns = ["Department", "Headcount", "Attendance %", "Open positions"];
    rows = departments.map((d) => {
      const count = scopedUsers.filter((u) => String(u.department || "") === String(d._id)).length;
      return [d.name, String(count), count ? String(rate ?? "—") : "—", "—"];
    }).filter((r) => r[1] !== "0");
  }
  return ok(res, {
    report: {
      type,
      title,
      subtitle,
      generatedAt: now.toISOString(),
      columns,
      rows,
      rowCount: rows.length,
    },
  });
});

const nameOf = (u) => `${u.firstName} ${u.lastName || ""}`.trim();
