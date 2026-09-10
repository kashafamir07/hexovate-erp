/**
 * Analytics helpers for the leader (HR) views.
 * All functions operate on raw document lists so the same math backs the
 * dashboard, people/profile pages, department pages and report exports.
 */
import { Attendance } from "../models/Attendance.js";
import { PerformanceReview } from "../models/PerformanceReview.js";
import { PayrollRecord } from "../models/PayrollRecord.js";
import { Request } from "../models/Request.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { Department } from "../models/Department.js";
import { JobPosting } from "../models/JobPosting.js";
import { avatarColor, initialsOf } from "../utils/serialize.js";
import { endOfMonth, lastMonths, monthKey, monthLabel, shiftMonths, startOfMonth } from "../utils/leader.js";

const DAY = 86400000;

/** Active org users (any role) with joinedAt/leftAt, resolving department names. */
export async function orgUsers() {
  const [users, departments] = await Promise.all([
    User.find({}).select("firstName lastName jobTitle role department manager status joinedAt leftAt email phone location employeeId employmentType leaveBalanceDays birthDate").lean(),
    Department.find({}).select("name").lean(),
  ]);
  const nameById = new Map(departments.map((d) => [String(d._id), d.name]));
  return users.map((u) => ({ ...u, departmentName: nameById.get(String(u.department || "")) || "" }));
}

/** Public leader-scope row for a user doc (id, avatar, job, dept). */
export function personRow(u) {
  const name = u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.name || "";
  return {
    id: String(u._id),
    name,
    initials: initialsOf(name),
    color: avatarColor(String(u._id || name)),
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    email: u.email || "",
    phone: u.phone || "",
    location: u.location || "",
    employeeId: u.employeeId || "",
    jobTitle: u.jobTitle || "",
    role: u.role || "employee",
    departmentId: u.department ? String(u.department) : null,
    departmentName: u.departmentName || u.department?.name || "",
    managerId: u.manager ? String(u.manager) : null,
    status: u.status || "active",
    employmentType: u.employmentType || "full_time",
    birthDate: u.birthDate || null,
    joinedAt: u.joinedAt || null,
  };
}

/* ---------------- attendance ---------------- */

/** Attendance records for userIds between `from` and `to` (inclusive), sorted by date. */
export async function attendanceRecords(userIds, from, to) {
  return Attendance.find({
    user: { $in: userIds },
    date: { $gte: from, $lte: to },
  })
    .sort({ date: 1, user: 1 })
    .lean();
}

/** Aggregate attendance records into per-month buckets with rates (0-100). */
export function monthlyAttendance(records, months = 6) {
  const buckets = new Map();
  for (const key of lastMonths(months)) buckets.set(key, { key, present: 0, late: 0, absent: 0, leave: 0, half: 0 });
  for (const r of records) {
    const key = monthKey(r.date);
    if (!buckets.has(key)) continue;
    const b = buckets.get(key);
    if (r.status === "present") b.present += 1;
    else if (r.status === "late") b.late += 1;
    else if (r.status === "absent") b.absent += 1;
    else if (r.status === "leave") b.leave += 1;
    else if (r.status === "half_day") b.half += 1;
  }
  return [...buckets.values()].map((b) => {
    const denom = b.present + b.late + b.absent;
    return {
      ...b,
      label: monthLabel(b.key),
      rate: denom ? Math.round(((b.present + b.late) / denom) * 1000) / 10 : null,
      tracked: denom,
    };
  });
}

/** Attendance today for userIds: status counts + per-user map. */
export async function attendanceToday(userIds) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY);
  const records = await Attendance.find({ user: { $in: userIds }, date: { $gte: start, $lt: end } }).lean();
  const byUser = new Map();
  for (const r of records) byUser.set(String(r.user), r);
  const counts = { present: 0, late: 0, absent: 0, leave: 0, half: 0 };
  for (const r of records) counts[r.status] = (counts[r.status] || 0) + 1;
  return { byUser, counts, records };
}

/* ---------------- leaves (Request type=leave) ---------------- */

/** Leave requests from userIds with a start/end date (any status), newest first. */
export async function leaveRequests(userIds, { from, to, status } = {}) {
  const filter = { requester: { $in: userIds }, type: "leave" };
  const dateFilter = [];
  if (from) dateFilter.push({ startDate: { $gte: from } });
  if (to) dateFilter.push({ startDate: { $lte: to } });
  if (dateFilter.length) filter.$and = dateFilter;
  if (status) filter.status = status;
  return Request.find(filter)
    .populate("requester", "firstName lastName jobTitle department")
    .populate("reviewer", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();
}

export const leaveTypeLabel = (t) =>
  ({ annual: "Annual", sick: "Sick", unpaid: "Unpaid", maternity: "Maternity", paternity: "Paternity", permission: "Permission", equipment: "Equipment", expense: "Expense", other: "Other", leave: "Leave" }[t] || t || "Leave");

export function leaveDays(req) {
  if (!req.startDate) return 0;
  const end = req.endDate || req.startDate;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(req.startDate).getTime()) / DAY) + 1);
}

/** Approved leave days grouped by start-date month. */
export function leaveByMonth(requests, months = 6) {
  const buckets = new Map();
  for (const key of lastMonths(months)) buckets.set(key, 0);
  for (const r of requests) {
    if (r.status !== "approved" || !r.startDate) continue;
    const key = monthKey(r.startDate);
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + leaveDays(r));
  }
  return [...buckets.entries()].map(([key, value]) => ({ key, label: monthLabel(key), value }));
}

/** Employees currently on approved leave (today within their leave window). */
export async function onLeaveToday(userIds) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY);
  const leaves = await Request.find({
    requester: { $in: userIds },
    type: "leave",
    status: "approved",
    startDate: { $lte: end },
    endDate: { $gte: start },
  })
    .populate("requester", "firstName lastName jobTitle")
    .lean();
  return leaves.map((l) => ({ requestId: String(l._id), ...personRow(l.requester), leaveType: l.title || "Leave" }));
}

/* ---------------- performance ---------------- */

const REVIEW_POP = [
  { path: "user", select: "firstName lastName jobTitle department manager" },
  { path: "reviewer", select: "firstName lastName" },
];

/** All reviews for userIds (user populated), newest period first. */
export async function performanceReviews(userIds, { period, status, search } = {}) {
  const filter = { user: { $in: userIds } };
  if (period) filter.period = period;
  if (status) filter.status = status;
  let docs = await PerformanceReview.find(filter).populate(REVIEW_POP).sort({ period: -1, createdAt: -1 }).lean();
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    docs = docs.filter((r) => {
      const u = r.user && typeof r.user === "object" ? r.user : null;
      return u && rx.test(`${u.firstName} ${u.lastName || ""} ${u.jobTitle || ""}`.trim());
    });
  }
  return docs;
}

/** Latest completed review per user + distribution + period averages. */
export async function perfSnapshot(userIds) {
  const reviews = await performanceReviews(userIds);
  const completed = reviews.filter((r) => r.status === "completed");
  const byUser = new Map(); // user -> latest completed review doc
  for (const r of completed) {
    const uid = String(r.user?._id || r.user);
    const cur = byUser.get(uid);
    if (!cur || String(r.period) > String(cur.period)) byUser.set(uid, r);
  }
  const latest = [...byUser.values()];
  const dist = { "Needs improvement": 0, Developing: 0, "Meets expectations": 0, "Exceeds expectations": 0, Outstanding: 0 };
  for (const r of latest) {
    const key = bucketOf(r.score);
    dist[key] += 1;
  }
  const periodAvg = (scores) => {
    if (!scores.length) return null;
    return Math.round((scores.reduce((s, x) => s + (x || 0), 0) / scores.length) * 10) / 10;
  };
  const allCompletedPeriods = [...new Set(completed.map((r) => String(r.period)))].sort().reverse();
  const currentPeriodAvg = allCompletedPeriods[0] ? periodAvg(completed.filter((r) => String(r.period) === allCompletedPeriods[0]).map((r) => r.score)) : null;
  const prevPeriodAvg = allCompletedPeriods[1] ? periodAvg(completed.filter((r) => String(r.period) === allCompletedPeriods[1]).map((r) => r.score)) : null;
  return { latest, byUser, dist, avg: periodAvg(latest.map((r) => r.score)), currentPeriodAvg, prevPeriodAvg, periods: allCompletedPeriods };
}

export const ratingOf = (score) => {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Exceeds expectations";
  if (score >= 70) return "Meets expectations";
  if (score >= 60) return "Developing";
  return "Needs improvement";
};

const bucketOf = (score) => ratingOf(score);

/* ---------------- payroll ---------------- */

/** Monthly payroll totals for the last `n` months (net/base/allowances/deductions). */
export async function payrollByMonth(n = 6) {
  const months = lastMonths(n);
  const records = await PayrollRecord.find({ month: { $in: months } }).lean();
  const buckets = new Map(months.map((m) => [m, { key: m, label: monthLabel(m), net: 0, base: 0, allowances: 0, deductions: 0, rows: 0 }]));
  for (const r of records) {
    const b = buckets.get(r.month);
    if (!b) continue;
    b.net += r.net || 0;
    b.base += r.base || 0;
    b.allowances += r.allowances || 0;
    b.deductions += r.deductions || 0;
    b.rows += 1;
  }
  return [...buckets.values()];
}

export async function payrollRecords(month) {
  return PayrollRecord.find({ month }).populate("user", "firstName lastName jobTitle department").lean();
}

/* ---------------- tasks ---------------- */

/** Task snapshot for assignees in userIds. */
export async function taskSnapshot(userIds) {
  const tasks = await Task.find({ assignedTo: { $in: userIds } })
    .populate("project", "name")
    .select("title status priority dueDate completedAt createdAt project assignedTo")
    .lean();
  const statusCounts = { todo: 0, in_progress: 0, review: 0, completed: 0 };
  const openByUser = new Map();
  const firstOpen = new Map();
  const doneByMonth = new Map();
  for (const t of tasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    const uid = String(t.assignedTo);
    if (t.status !== "completed") {
      openByUser.set(uid, (openByUser.get(uid) || 0) + 1);
      if (!firstOpen.has(uid)) firstOpen.set(uid, t);
    } else if (t.completedAt) {
      const key = monthKey(t.completedAt);
      doneByMonth.set(key, (doneByMonth.get(key) || 0) + 1);
    }
  }
  return { total: tasks.length, statusCounts, openByUser, firstOpen, doneByMonth, tasks };
}

/* ---------------- recruitment / headcount ---------------- */

export async function openPositions() {
  return JobPosting.find({ status: "open" }).populate("department", "name").sort({ postedAt: -1 }).lean();
}

/** Cumulative-active headcount / new hires / leavers per month (from joinedAt/leftAt). */
export function headcountSeries(users, months = 8) {
  const keys = lastMonths(months);
  return keys.map((key) => {
    const monthEnd = endOfMonth(new Date(`${key}-15T12:00:00`));
    const joined = users.filter((u) => u.joinedAt && new Date(u.joinedAt) <= monthEnd && (!u.leftAt || new Date(u.leftAt) > monthEnd)).length;
    return { key, label: monthLabel(key), value: joined };
  });
}

/** New hires & leavers bucketed by month key. */
export function movementByMonth(users, months = 8) {
  const buckets = new Map(lastMonths(months).map((m) => [m, { key: m, label: monthLabel(m), hires: 0, left: 0 }]));
  for (const u of users) {
    if (u.joinedAt) {
      const key = monthKey(u.joinedAt);
      if (buckets.has(key)) buckets.get(key).hires += 1;
    }
    if (u.leftAt) {
      const key = monthKey(u.leftAt);
      if (buckets.has(key)) buckets.get(key).left += 1;
    }
  }
  return [...buckets.values()];
}

/** Active headcount at each month end, plus hires/leavers that month. */
export function orgHeadcountSeries(users, months = 8) {
  const movement = movementByMonth(users, months);
  const keys = lastMonths(months);
  const byMonth = new Map(movement.map((m) => [m.key, m]));
  for (const key of keys) {
    const end = endOfMonth(new Date(`${key}-15T12:00:00`));
    const active = users.filter((u) => u.joinedAt && new Date(u.joinedAt) <= end && (!u.leftAt || new Date(u.leftAt) > end)).length;
    byMonth.get(key).value = active;
  }
  return keys.map((key) => ({ ...byMonth.get(key), label: monthLabel(key) }));
}

/** Count users who joined within `from`..`to` (inclusive). */
export function joinedBetween(users, from, to) {
  return users.filter((u) => u.joinedAt && new Date(u.joinedAt) >= from && new Date(u.joinedAt) <= to);
}

export function leftBetween(users, from, to) {
  return users.filter((u) => u.leftAt && new Date(u.leftAt) >= from && new Date(u.leftAt) <= to);
}

export { shiftMonths };
