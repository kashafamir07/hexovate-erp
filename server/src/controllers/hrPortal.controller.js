import { Request } from "../models/Request.js";
import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { Department } from "../models/Department.js";
import { JobPosting } from "../models/JobPosting.js";
import { Announcement } from "../models/Announcement.js";
import { Task } from "../models/Task.js";
import { OnboardingRecord, OffboardingRecord, ONBOARDING_STEPS, OFFBOARDING_STEPS } from "../models/Lifecycle.js";
import { DocumentModel as Document } from "../models/Document.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, created, noContent } from "../utils/response.js";
import { ApiError } from "../utils/ApiError.js";
import * as an from "../services/analytics.service.js";
import { relTime } from "../utils/ui.js";
import { scopeOf } from "../utils/leader.js";
import { notify } from "../services/notification.service.js";

const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameOf = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "");
const dayLabel = (d) => (d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—");
const DAY = 86400000;

/* HR portal + department-head shared scope (HR/leaders see the org; DH their department). */

/* ============================ dashboard ============================ */

const birthdayInfo = (u, now) => {
  if (!u.birthDate) return null;
  const b = new Date(u.birthDate);
  const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  const next = thisYear >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? thisYear : new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
  const days = Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
  return { days, label: days === 0 ? "Today" : days === 1 ? "Tomorrow" : dayLabel(next) };
};

const anniversaryInfo = (u, now) => {
  if (!u.joinedAt) return null;
  const j = new Date(u.joinedAt);
  const years = now.getFullYear() - j.getFullYear();
  const hadThisYear = now > new Date(now.getFullYear(), j.getMonth(), j.getDate());
  if (years < 1 || (years === 1 && !hadThisYear)) return null;
  const next = new Date(now.getFullYear(), j.getMonth(), j.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(now.getFullYear() + 1);
  const days = Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
  return { years, days, label: days === 0 ? "Today" : days <= 7 ? `${dayLabel(next)}` : dayLabel(next) };
};

/** GET /hr/portal/dashboard — HR portal + department-head dashboard payload. */
export const hrPortalDashboard = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const ids = scope.userIds;
  const now = new Date();

  const [users, requests, monthRecords, pendingOn, pendingOff, deptDocs, announcement, positions, tasks] = await Promise.all([
    an.orgUsers(),
    Request.find({ requester: { $in: ids }, status: "pending" }).populate("requester", "firstName lastName jobTitle department").sort({ createdAt: -1 }).limit(50).lean(),
    an.attendanceRecords(ids, new Date(now.getFullYear(), now.getMonth(), 1), now),
    OnboardingRecord.find().populate("user", "firstName lastName jobTitle department").sort({ startDate: 1 }).lean(),
    OffboardingRecord.find().populate("user", "firstName lastName jobTitle department").sort({ lastWorkingDay: 1 }).lean(),
    Department.find({}).select("name members").lean(),
    Announcement.findOne({ status: { $ne: "archived" } }).sort({ publishedAt: -1, createdAt: -1 }).populate("author", "firstName lastName").lean(),
    JobPosting.find({ status: "open" }).select("openings department").lean(),
    Task.countDocuments({ assignedTo: { $in: ids }, status: { $ne: "completed" } }),
  ]);

  const byId = new Map(users.map((u) => [String(u._id), u]));
  const deptName = (d) => (d && typeof d === "object" ? d.name : byId.get(String(d))?.departmentName || "");
  const inScope = new Set(ids.map(String));

  // KPIs
  const headcount = users.filter((u) => u.status === "active" && inScope.has(String(u._id))).length;
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const newHires = users.filter((u) => u.joinedAt && new Date(u.joinedAt) >= monthAgo && u.status === "active" && inScope.has(String(u._id))).length;
  const onLeaveToday = await an.onLeaveToday(ids);
  const openings = positions.reduce((s, p) => s + (p.openings || 1), 0);

  // attendance snapshot (today; falls back to the most recent marked day so
  // weekends/holidays don't render an empty-looking widget)
  let todaySnap = await an.attendanceToday(ids);
  let snapshotLabel = "Today";
  if (!todaySnap.records.length) {
    const last = await Attendance.findOne({ user: { $in: ids } }).sort({ date: -1 }).select("date").lean();
    if (last) {
      const d = new Date(last.date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + DAY);
      const records = await Attendance.find({ user: { $in: ids }, date: { $gte: start, $lt: end } }).lean();
      const counts2 = { present: 0, late: 0, absent: 0, leave: 0, half: 0 };
      for (const r of records) counts2[r.status] = (counts2[r.status] || 0) + 1;
      todaySnap = { byUser: new Map(records.map((r) => [String(r.user), r])), counts: counts2, records };
      snapshotLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
  }
  const counts = { ...todaySnap.counts };
  counts.onLeave = counts.leave || 0;

  // pending approvals table
  const waitingDays = (r) => Math.max(1, Math.round((now - new Date(r.createdAt)) / DAY));
  const approvals = requests.slice(0, 6).map((r) => {
    const who = r.requester && typeof r.requester === "object" ? r.requester : null;
    const deptId = who?.department && typeof who.department === "object" ? who.department._id : who?.department;
    return {
      id: String(r._id),
      person: who ? an.personRow(who) : null,
      dept: deptId ? deptName(deptId) : "",
      kind: r.type === "expense" ? "Expense Claim" : r.type === "leave" ? `${titleCase(r.title || "Leave")}` : titleCase(r.type),
      detail:
        r.type === "expense" && r.amount != null
          ? `PKR ${Number(r.amount).toLocaleString()}`
          : r.startDate
            ? `${dayLabel(r.startDate)}${r.endDate ? ` – ${dayLabel(r.endDate)}` : ""}${r.days ? ` (${r.days} days)` : ""}`
            : r.description || "—",
      waiting: waitingDays(r),
      waitingLabel: `${waitingDays(r)} day${waitingDays(r) > 1 ? "s" : ""}`,
      urgent: waitingDays(r) >= 3,
    };
  });

  // birthdays & anniversaries (next 30 days, then by date)
  const events = [];
  for (const u of users) {
    if (u.status !== "active") continue;
    const person = an.personRow(u);
    const b = birthdayInfo(u, now);
    if (b && b.days <= 30) events.push({ id: `b-${String(u._id)}`, person, kind: "Birthday", label: `${person.name} — Birthday`, when: b.label, sort: b.days });
    const a = anniversaryInfo(u, now);
    if (a && a.days <= 30) events.push({ id: `a-${String(u._id)}`, person, kind: "Work Aniv.", label: `${person.name} — Work Aniv.`, when: a.days === 0 ? "Today" : `${a.years}y · ${dayLabel(new Date(now.getFullYear(), new Date(u.joinedAt).getMonth(), new Date(u.joinedAt).getDate()))}`, sort: a.days });
  }
  events.sort((x, y) => x.sort - y.sort);

  // team activity (reuse the ops feed logic, scoped)
  const feed = [];
  const since = new Date(now.getTime() - 14 * DAY);
  const [recentTasks, recentReqs] = await Promise.all([
    Task.find({ assignedTo: { $in: ids }, createdAt: { $gte: since } }).populate("assignedTo", "firstName lastName jobTitle").sort({ createdAt: -1 }).limit(15).lean(),
    Request.find({ requester: { $in: ids }, createdAt: { $gte: since } }).populate("requester", "firstName lastName jobTitle").sort({ createdAt: -1 }).limit(15).lean(),
  ]);
  for (const t of recentTasks) {
    const who = t.assignedTo && typeof t.assignedTo === "object" ? an.personRow(t.assignedTo) : null;
    if (!who) continue;
    feed.push({ id: `t-${String(t._id)}`, person: who, text: `${who.name} ${t.status === "completed" ? "completed" : "updated"} ${t.title || "a task"}`, ts: t.completedAt || t.createdAt });
  }
  for (const r of recentReqs) {
    const who = r.requester && typeof r.requester === "object" ? an.personRow(r.requester) : null;
    if (!who) continue;
    feed.push({ id: `r-${String(r._id)}`, person: who, text: `${who.name} submitted ${r.type === "leave" ? "a leave request" : `a ${r.type} request`} for review`, ts: r.createdAt });
  }
  for (const o of pendingOn) {
    const who = o.user && typeof o.user === "object" ? an.personRow(o.user) : null;
    if (!who) continue;
    feed.push({ id: `o-${String(o._id)}`, person: who, text: `${who.name} started onboarding — ${o.steps.filter((s) => s.done).length}/${o.steps.length} checklist done`, ts: o.createdAt });
  }
  feed.sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const openPositionsByDept = new Map();
  for (const p of positions) {
    const key = p.department && typeof p.department === "object" ? String(p.department) : "";
    openPositionsByDept.set(key, (openPositionsByDept.get(key) || 0) + (p.openings || 1));
  }
  const openDepartments = [...openPositionsByDept.entries()].slice(0, 2).map(([, v]) => v);

  return ok(res, {
    portal: {
      scope: { type: scope.type, name: scope.name },
      greetingName: actor.firstName,
      kpis: {
        headcount,
        newHires,
        pendingApprovals: requests.length,
        onLeave: onLeaveToday.length,
        openPositions: openings,
        openTasks: tasks,
      },
      approvals,
      attendance: {
        present: counts.present,
        onLeave: counts.onLeave,
        late: counts.late,
        absent: counts.absent,
        rate: ids.length ? Math.round(((counts.present + counts.late) / Math.max(1, counts.present + counts.late + counts.absent)) * 100) : null,
        label: snapshotLabel,
      },
      events: events.slice(0, 4),
      announcement: announcement
        ? {
            id: String(announcement._id),
            title: announcement.title,
            content: announcement.content,
            author: announcement.author ? nameOf(announcement.author) : "HR",
            when: relTime(announcement.publishedAt || announcement.createdAt, now),
          }
        : null,
      activity: feed.slice(0, 5).map((f) => ({
        id: f.id,
        initials: f.person.initials,
        color: f.person.color,
        name: f.person.name,
        text: f.text,
        when: relTime(f.ts, now),
      })),
      onboardingCount: pendingOn.length,
      offboardingCount: pendingOff.length,
      openPositionsNote: openDepartments.length ? `Across ${openDepartments.length} departments` : "",
    },
  });
});

const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());

/* ============================ onboarding ============================ */

const onboardRow = (o) => {
  const who = o.user && typeof o.user === "object" ? o.user : null;
  const done = o.steps.filter((s) => s.done).length;
  return {
    id: String(o._id),
    person: who ? an.personRow(who) : null,
    jobTitle: o.jobTitle || who?.jobTitle || "",
    dept: o.department && typeof o.department === "object" ? o.department.name : "",
    startLabel: dayLabel(o.startDate),
    startDate: o.startDate,
    progress: { done, total: o.steps.length },
    progressLabel: `${done}/${o.steps.length} tasks`,
    status: o.status,
    statusLabel: o.status === "complete" ? "Complete" : o.status === "not_started" ? "Just Started" : "Info",
    steps: o.steps,
  };
};

/** GET /hr/portal/onboarding */
export const hrOnboardingList = asyncHandler(async (req, res) => {
  const rows = await OnboardingRecord.find().populate("user", "firstName lastName jobTitle").populate("department", "name").sort({ startDate: -1 }).lean();
  return ok(res, { items: rows.map(onboardRow), stepsTemplate: ONBOARDING_STEPS });
});

/** POST /hr/portal/onboarding — start onboarding for a user (creates default checklist). */
export const hrCreateOnboarding = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { userId, startDate, jobTitle, department } = req.body;
  if (!userId) throw new ApiError(422, "Employee is required", [{ field: "userId", msg: "Employee is required" }]);
  const user = await User.findById(userId).select("firstName lastName jobTitle department status");
  if (!user) throw new ApiError(404, "Employee not found");
  if (await OnboardingRecord.exists({ user: userId })) throw new ApiError(409, "Onboarding already exists for this employee");

  const record = await OnboardingRecord.create({
    user: userId,
    jobTitle: jobTitle || user.jobTitle || "",
    department: department || user.department || null,
    startDate: startDate || new Date(),
    steps: ONBOARDING_STEPS.map((label) => ({ label, done: false })),
    status: "not_started",
    createdBy: actor._id,
  });
  await notify({ users: [userId], type: "system", title: "Your onboarding has started", message: `${actor.firstName} ${actor.lastName} started your onboarding checklist.` });
  const full = await OnboardingRecord.findById(record._id).populate("user", "firstName lastName jobTitle").populate("department", "name").lean();
  return created(res, { item: onboardRow(full) }, "Onboarding started");
});

/** PATCH /hr/portal/onboarding/:id — toggle a step / rename. */
export const hrUpdateOnboarding = asyncHandler(async (req, res) => {
  const record = await OnboardingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, "Onboarding record not found");
  const { stepIndex, done, jobTitle, startDate } = req.body;
  if (jobTitle !== undefined) record.jobTitle = jobTitle;
  if (startDate !== undefined) record.startDate = startDate;
  if (stepIndex !== undefined) {
    const i = Number(stepIndex);
    if (!record.steps[i]) throw new ApiError(422, "Unknown checklist step");
    record.steps[i].done = Boolean(done);
    const allDone = record.steps.every((s) => s.done);
    record.status = allDone ? "complete" : record.steps.some((s) => s.done) ? "in_progress" : "not_started";
  }
  await record.save();
  const full = await OnboardingRecord.findById(record._id).populate("user", "firstName lastName jobTitle").populate("department", "name").lean();
  return ok(res, { item: onboardRow(full) }, "Checklist updated");
});

/** DELETE /hr/portal/onboarding/:id */
export const hrDeleteOnboarding = asyncHandler(async (req, res) => {
  await OnboardingRecord.findByIdAndDelete(req.params.id);
  return noContent(res);
});

/* ============================ offboarding ============================ */

const offboardRow = (o) => {
  const who = o.user && typeof o.user === "object" ? o.user : null;
  const done = o.steps.filter((s) => s.done).length;
  return {
    id: String(o._id),
    person: who ? an.personRow(who) : null,
    jobTitle: o.jobTitle || who?.jobTitle || "",
    dept: o.department && typeof o.department === "object" ? o.department.name : "",
    lastDayLabel: dayLabel(o.lastWorkingDay),
    lastWorkingDay: o.lastWorkingDay,
    reason: o.reason,
    progress: { done, total: o.steps.length },
    progressLabel: `${done}/${o.steps.length} tasks`,
    status: o.status,
    steps: o.steps,
  };
};

/** GET /hr/portal/offboarding */
export const hrOffboardingList = asyncHandler(async (req, res) => {
  const rows = await OffboardingRecord.find().populate("user", "firstName lastName jobTitle").populate("department", "name").sort({ lastWorkingDay: -1 }).lean();
  return ok(res, { items: rows.map(offboardRow), stepsTemplate: OFFBOARDING_STEPS });
});

/** POST /hr/portal/offboarding */
export const hrCreateOffboarding = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { userId, lastWorkingDay, reason, jobTitle, department } = req.body;
  if (!userId) throw new ApiError(422, "Employee is required", [{ field: "userId", msg: "Employee is required" }]);
  const user = await User.findById(userId).select("firstName lastName jobTitle department");
  if (!user) throw new ApiError(404, "Employee not found");
  if (await OffboardingRecord.exists({ user: userId })) throw new ApiError(409, "Offboarding already exists for this employee");

  const record = await OffboardingRecord.create({
    user: userId,
    jobTitle: jobTitle || user.jobTitle || "",
    department: department || user.department || null,
    lastWorkingDay: lastWorkingDay || new Date(),
    reason: reason || "Resignation",
    steps: OFFBOARDING_STEPS.map((label) => ({ label, done: false })),
    status: "not_started",
    createdBy: actor._id,
  });
  await notify({ users: [userId], type: "system", title: "Offboarding initiated", message: "Your exit checklist has been created. Contact HR for details." });
  const full = await OffboardingRecord.findById(record._id).populate("user", "firstName lastName jobTitle").populate("department", "name").lean();
  return created(res, { item: offboardRow(full) }, "Offboarding initiated");
});

/** PATCH /hr/portal/offboarding/:id */
export const hrUpdateOffboarding = asyncHandler(async (req, res) => {
  const record = await OffboardingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, "Offboarding record not found");
  const { stepIndex, done, reason, lastWorkingDay } = req.body;
  if (reason !== undefined) record.reason = reason;
  if (lastWorkingDay !== undefined) record.lastWorkingDay = lastWorkingDay;
  if (stepIndex !== undefined) {
    const i = Number(stepIndex);
    if (!record.steps[i]) throw new ApiError(422, "Unknown checklist step");
    record.steps[i].done = Boolean(done);
    const allDone = record.steps.every((s) => s.done);
    record.status = allDone ? "complete" : record.steps.some((s) => s.done) ? "in_progress" : "not_started";
  }
  await record.save();
  const full = await OffboardingRecord.findById(record._id).populate("user", "firstName lastName jobTitle").populate("department", "name").lean();
  return ok(res, { item: offboardRow(full) }, "Checklist updated");
});

/** DELETE /hr/portal/offboarding/:id */
export const hrDeleteOffboarding = asyncHandler(async (req, res) => {
  await OffboardingRecord.findByIdAndDelete(req.params.id);
  return noContent(res);
});

/* ============================ documents / misc ============================ */

/** GET /hr/portal/documents — org-wide employee document summary (HR only in practice). */
export const hrDocuments = asyncHandler(async (req, res) => {
  const scope = await scopeOf(req.user);
  const users = await an.orgUsers();
  const mine = users.filter((u) => scope.userIds.some((id) => String(id) === String(u._id)));
  const docs = await Document.find({ employee: { $in: scope.userIds } }).sort({ uploadedAt: -1 }).lean();
  const nameById = new Map(mine.map((u) => [String(u._id), u]));
  const byCat = { contract: 0, id: 0, review: 0, tax: 0, other: 0 };
  for (const d of docs) byCat[d.category] = (byCat[d.category] || 0) + 1;
  const covered = new Set(docs.map((d) => String(d.employee)));
  const categories = [
    { id: "contracts", label: "Employment Contracts", count: byCat.contract, coverage: mine.length ? Math.round((byCat.contract / mine.length) * 100) : 0 },
    { id: "id", label: "ID Documents (CNIC)", count: byCat.id, coverage: mine.length ? Math.round((byCat.id / mine.length) * 100) : 0 },
    { id: "review", label: "Performance Reviews", count: byCat.review, coverage: mine.length ? Math.round((byCat.review / mine.length) * 100) : 0 },
    { id: "tax", label: "Tax Forms", count: byCat.tax, coverage: mine.length ? Math.round((byCat.tax / mine.length) * 100) : 0 },
    { id: "other", label: "Other Documents", count: byCat.other, coverage: mine.length ? Math.round((byCat.other / mine.length) * 100) : 0 },
  ];
  const recent = docs.slice(0, 6).map((d) => {
    const u = nameById.get(String(d.employee));
    const p = u ? an.personRow(u) : { id: String(d.employee), name: "Unknown", initials: "?", color: "#94a3b8" };
    return { id: String(d._id), person: p, doc: d.title, when: d.uploadedAt ? dayLabel(d.uploadedAt) : "—" };
  });
  return ok(res, {
    summary: { employees: covered.size, filed: docs.length },
    categories,
    recent,
  });
});

/** GET /hr/portal/reports — shortcut list of HR reports (real /hr/reports data). */
export const hrPortalReports = asyncHandler(async (req, res) => {
  const items = [
    { id: "headcount", label: "Headcount Report", description: "Active employees by month", to: "headcount" },
    { id: "leave", label: "Leave Report", description: "Leave requests with statuses", to: "leave" },
    { id: "attendance", label: "Attendance Report", description: "Present/late/absent per employee", to: "attendance" },
    { id: "recruitment", label: "Recruitment Report", description: "Open positions and hires", to: "recruitment" },
    { id: "payroll", label: "Payroll Report", description: "Monthly payroll register", to: "payroll" },
  ];
  return ok(res, { items });
});
