import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { Department } from "../models/Department.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { ok } from "../utils/response.js";
import { ApiError } from "../utils/ApiError.js";
import { scopeOf } from "../utils/leader.js";
import { addDays, uiTime, weekStart } from "../utils/ui.js";
import * as an from "../services/analytics.service.js";

const DAY = 86400000;
const STATUS_LABEL = { present: "Present", late: "Late", absent: "Absent", leave: "On leave", half_day: "Half day" };
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

async function scopeAndDeptNames(actor) {
  const scope = await scopeOf(actor);
  const departments = await Department.find({}).select("name").lean();
  const nameById = new Map(departments.map((d) => [String(d._id), d.name]));
  return { scope, nameById };
}

/** GET /hr/attendance/today — today's roster with statuses (scoped). */
export const hrAttendanceToday = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { scope, nameById } = await scopeAndDeptNames(actor);
  const ids = scope.userIds;
  const [today, onLeave, people] = await Promise.all([an.attendanceToday(ids), an.onLeaveToday(ids), an.orgUsers()]);
  const onLeaveIds = new Set(onLeave.map((o) => o.id));
  const byId = new Map(people.map((p) => [String(p._id), p]));

  const rows = ids
    .map((id) => {
      const u = byId.get(String(id));
      if (!u) return null;
      const rec = today.byUser.get(String(id));
      const out = onLeaveIds.has(String(id));
      const status = out ? "leave" : rec?.status || "absent";
      return {
        id: String(id),
        employeeId: u.employeeId || "",
        ...an.personRow(u),
        departmentName: nameById.get(String(u.department || "")) || u.departmentName || "",
        status,
        statusLabel: STATUS_LABEL[status],
        checkIn: rec?.clockIn ? uiTime(rec.clockIn) : out ? "—" : "—",
        hours: rec?.hours ? `${rec.hours}h` : "—",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.status === "absent") - (a.status === "absent") || a.departmentName.localeCompare(b.departmentName) || a.name.localeCompare(b.name));

  const counts = { present: today.counts.present, late: today.counts.late, absent: today.counts.absent, leave: onLeave.length };
  const denom = counts.present + counts.late + counts.absent;
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return ok(res, {
    date: dateLabel,
    scope: { type: scope.type, name: scope.name },
    counts,
    rate: denom ? Math.round(((counts.present + counts.late) / denom) * 1000) / 10 : null,
    rows,
  });
});

/** GET /hr/attendance — record list within a range, filtered (scoped). */
export const hrAttendanceList = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { scope, nameById } = await scopeAndDeptNames(actor);
  const { from, to, status, employee, department } = req.query;
  const now = new Date();
  const fromDate = from ? new Date(from) : addDays(now, -30);
  const toDate = to ? new Date(`${String(to)}T23:59:59`) : now;
  const filter = { user: { $in: scope.userIds }, date: { $gte: fromDate, $lte: toDate } };
  if (status) filter.status = status;
  if (employee) filter.user = employee;
  if (department) {
    const members = await User.find({ department, status: "active" }).select("_id").lean();
    filter.user = { $in: members.map((m) => m._id) };
  }
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 100, maxLimit: 200 });
  const [total, records] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.find(filter).populate("user", "firstName lastName jobTitle department employeeId").sort({ date: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const items = records.map((r) => {
    const u = r.user && typeof r.user === "object" ? r.user : null;
    const person = an.personRow(u || { _id: r.user });
    return {
      id: String(r._id),
      date: isoDate(r.date),
      dateLabel: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...person,
      departmentName: u?.department ? nameById.get(String(u.department)) || "" : "",
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      clockIn: r.clockIn ? uiTime(r.clockIn) : "—",
      clockOut: r.clockOut ? uiTime(r.clockOut) : "—",
      hours: r.hours ? `${r.hours}h` : "—",
    };
  });
  return ok(res, { items, total, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
});

/** GET /hr/attendance/summary — monthly attendance buckets. */
export const hrAttendanceSummary = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const months = Math.min(12, Math.max(2, Number(req.query.months) || 6));
  const records = await an.attendanceRecords(scope.userIds, addDays(new Date(), -(months * 40)), new Date());
  const monthly = an.monthlyAttendance(records, months + 1)
    .filter((m) => m.key <= monthKeyNow())
    .slice(-months);
  return ok(res, {
    scope: { type: scope.type, name: scope.name },
    monthly: monthly.map((m) => ({ key: m.key, label: m.label, rate: m.rate, present: m.present, late: m.late, absent: m.absent, leave: m.leave, half: m.half })),
  });
});

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** GET /hr/attendance/trend — weekly attendance rate (last `weeks` weeks). */
export const hrAttendanceTrend = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const weeks = Math.min(16, Math.max(4, Number(req.query.weeks) || 8));
  const monday = weekStart(new Date());
  const from = addDays(monday, -(weeks - 1) * 7);
  const records = await an.attendanceRecords(scope.userIds, from, new Date());

  const points = [];
  for (let i = 0; i < weeks; i += 1) {
    const start = addDays(monday, -(weeks - 1 - i) * 7);
    const end = addDays(start, 7);
    const week = records.filter((r) => r.date >= start && r.date < end);
    const denom = week.filter((r) => r.status === "present" || r.status === "late" || r.status === "absent").length;
    const presentLate = week.filter((r) => r.status === "present" || r.status === "late").length;
    points.push({
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: denom ? Math.round((presentLate / denom) * 1000) / 10 : null,
    });
  }
  return ok(res, { points });
});

/** GET /hr/attendance/:id — one employee's history (scoped). */
export const hrAttendanceHistory = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  if (!scope.userIds.some((id) => String(id) === String(req.params.id))) throw new ApiError(403, "This employee is not in your scope");
  const days = Math.min(90, Math.max(10, Number(req.query.days) || 45));
  const from = addDays(new Date(), -days);
  const records = await Attendance.find({ user: req.params.id, date: { $gte: from } }).sort({ date: -1 }).lean();
  const monthly = an.monthlyAttendance(records, 3);
  const rows = records.map((r) => ({
    id: String(r._id),
    date: isoDate(r.date),
    dateLabel: new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    status: r.status,
    statusLabel: STATUS_LABEL[r.status],
    clockIn: r.clockIn ? uiTime(r.clockIn) : "—",
    clockOut: r.clockOut ? uiTime(r.clockOut) : "—",
    hours: r.hours ? `${r.hours}h` : "—",
  }));
  const last = monthly.filter((m) => m.rate != null).pop();
  return ok(res, { personId: req.params.id, monthly, lastMonthRate: last ? last.rate : null, items: rows });
});
