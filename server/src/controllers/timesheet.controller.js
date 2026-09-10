import { TimeEntry } from "../models/TimeEntry.js";
import { Timesheet } from "../models/Timesheet.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, ok } from "../utils/response.js";
import { notifyTimesheet } from "../services/notification.service.js";
import { addDays, hoursLabel, monthDay, weekStart } from "../utils/ui.js";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toMidnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekEnd(start) {
  return new Date(toMidnight(start).getTime() + 7 * 86400000);
}

/** Week grid labels, e.g. ["Mon 2","Tue 3", ...] starting at the weekStart. */
function dayLabels(start) {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(toMidnight(start).getTime() + i * 86400000);
    days.push(`${DAY_LABELS[d.getDay()]} ${d.getDate()}`);
  }
  return days;
}

function weekLabel(start) {
  return `${monthDay(start)} – ${monthDay(new Date(weekEnd(start).getTime() - 86400000))}, ${new Date(start).getFullYear()}`;
}

/** Build the week-grid view model the timesheet UI renders. */
export async function buildWeekView(userId, start, status) {
  const s = toMidnight(start);
  const e = weekEnd(s);
  const entries = await TimeEntry.find({ user: userId, date: { $gte: s, $lt: e }, status: "stopped" }).lean();

  const byProject = new Map(); // projectName -> minutes per day index
  for (const entry of entries) {
    if (!entry.date) continue;
    const dayIdx = Math.floor((toMidnight(entry.date).getTime() - s.getTime()) / 86400000);
    const name = entry.projectName || "Internal / Admin";
    if (!byProject.has(name)) byProject.set(name, new Array(7).fill(0));
    byProject.get(name)[dayIdx] += entry.duration || 0;
  }

  const rows = [...byProject.entries()]
    .map(([project, days]) => ({
      project,
      days: days.map((m) => (m > 0 ? String(Math.round(m / 60 * 100) / 100) : null)),
      total: hoursLabel(days.reduce((a, b) => a + b, 0)),
    }))
    .sort((a, b) => Number(b.total) - Number(a.total));

  const totals = new Array(7).fill(0);
  for (const row of rows) for (let i = 0; i < 7; i += 1) totals[i] += row.days[i] ? Number(row.days[i]) : 0;
  const grandTotal = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);

  return {
    weekStart: s,
    weekLabel: weekLabel(s),
    days: dayLabels(s),
    rows,
    totals: totals.map((t) => String(Math.round(t * 100) / 100)),
    grandTotal: String(Math.round(grandTotal * 100) / 100),
    status: status || "draft",
    entryCount: entries.length,
  };
}

export async function getOrCreateSheet(userId, week) {
  const s = toMidnight(week);
  let sheet = await Timesheet.findOne({ user: userId, weekStart: s });
  if (!sheet) {
    sheet = await Timesheet.create({ user: userId, weekStart: s, totalHours: 0 });
  }
  return sheet;
}

async function assertSheetAccess(sheet, actor) {
  const privileged = actor.role === "admin" || actor.role === "hr";
  const isOwner = String(sheet.user) === String(actor._id);
  if (isOwner || privileged) return "owner";
  if (actor.role === "manager") {
    const owner = await User.findById(sheet.user).select("manager").lean();
    if (owner && String(owner.manager || "") === String(actor._id)) return "reviewer";
  }
  throw new ApiError(403, "You cannot access this timesheet");
}

/** GET /api/timesheets/mine/current — week view for the timesheet page (?offset=-1|0|1…). */
export const myCurrentWeek = asyncHandler(async (req, res) => {
  const offset = Number(req.query.offset) || 0;
  const start = weekStart(addDays(new Date(), offset * 7));
  const sheet = await Timesheet.findOne({ user: req.userId, weekStart: toMidnight(start) }).lean();
  const view = await buildWeekView(req.userId, start, sheet?.status);
  return ok(res, { timesheet: { ...view, id: sheet?._id ? String(sheet._id) : null } });
});

export const listTimesheets = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { status, user } = req.query;
  const filter = {};
  const privileged = actor.role === "admin" || actor.role === "hr";
  if (status) filter.status = status;
  if (user) filter.user = user;
  if (!privileged && !user) {
    if (actor.role === "manager") {
      const reports = await User.find({ manager: actor._id }).select("_id").lean();
      filter.user = { $in: [actor._id, ...reports.map((r) => r._id)] };
    } else {
      filter.user = actor._id;
    }
  }
  const sheets = await Timesheet.find(filter)
    .populate("user", "firstName lastName")
    .sort({ weekStart: -1 })
    .limit(200)
    .lean();
  return ok(res, {
    items: sheets.map((s) => ({
      id: String(s._id),
      user: s.user ? `${s.user.firstName} ${s.user.lastName}` : "",
      weekStart: s.weekStart,
      weekLabel: weekLabel(s.weekStart),
      totalHours: s.totalHours,
      status: s.status,
      submittedAt: s.submittedAt,
      approvedBy: s.approvedBy ? String(s.approvedBy) : null,
      approvedAt: s.approvedAt,
    })),
  });
});

export const getTimesheet = asyncHandler(async (req, res) => {
  const sheet = await Timesheet.findById(req.params.id).lean();
  if (!sheet) throw new ApiError(404, "Timesheet not found");
  await assertSheetAccess(sheet, req.user);
  const view = await buildWeekView(sheet.user, sheet.weekStart, sheet.status);
  return ok(res, { timesheet: { ...view, id: String(sheet._id) } });
});

export const createTimesheet = asyncHandler(async (req, res) => {
  const { week, entries = [] } = req.body;
  const s = weekStart(week ? new Date(week) : new Date());
  const existing = await Timesheet.findOne({ user: req.userId, weekStart: toMidnight(s) });
  if (existing) throw new ApiError(409, "Timesheet already exists for this week");
  const totalHours = entries.reduce((sum, id) => sum, 0);
  const sheet = await Timesheet.create({ user: req.userId, weekStart: toMidnight(s), entries, totalHours });
  return created(res, { timesheet: { id: String(sheet._id), weekStart: sheet.weekStart, status: sheet.status } }, "Timesheet created");
});

export const updateTimesheet = asyncHandler(async (req, res) => {
  const sheet = await Timesheet.findById(req.params.id);
  if (!sheet) throw new ApiError(404, "Timesheet not found");
  const access = await assertSheetAccess(sheet, req.user);
  if (access === "reviewer" && req.body.entries) throw new ApiError(403, "Reviewers cannot edit entries");
  if (sheet.status !== "draft" && sheet.status !== "rejected") {
    throw new ApiError(409, "Only draft or rejected timesheets can be edited");
  }
  if (req.body.entries !== undefined) {
    const entries = await TimeEntry.find({ _id: { $in: req.body.entries } });
    sheet.entries = entries.map((e) => e._id);
    sheet.totalHours = entries.reduce((sum, e) => sum + (e.duration || 0), 0) / 60;
  }
  await sheet.save();
  return ok(res, { timesheet: { id: String(sheet._id), status: sheet.status } }, "Timesheet updated");
});

export const submitTimesheet = asyncHandler(async (req, res) => {
  const sheet = await Timesheet.findById(req.params.id);
  if (!sheet) throw new ApiError(404, "Timesheet not found");
  if (String(sheet.user) !== String(req.userId)) throw new ApiError(403, "Only the owner can submit");
  if (sheet.status === "submitted" || sheet.status === "approved") throw new ApiError(409, "Timesheet already submitted");
  const entries = await TimeEntry.find({ _id: { $in: sheet.entries }, user: sheet.user });
  sheet.totalHours = entries.reduce((sum, e) => sum + (e.duration || 0), 0) / 60;
  sheet.status = "submitted";
  sheet.submittedAt = new Date();
  await sheet.save();
  await notifyTimesheet(sheet.user, weekLabel(sheet.weekStart), "submitted");
  return ok(res, { timesheet: { id: String(sheet._id), status: sheet.status, totalHours: Math.round(sheet.totalHours * 100) / 100 } }, "Timesheet submitted");
});

export const approveTimesheet = asyncHandler(async (req, res) => {
  const sheet = await Timesheet.findById(req.params.id);
  if (!sheet) throw new ApiError(404, "Timesheet not found");
  const access = await assertSheetAccess(sheet, req.user);
  if (access === "owner") throw new ApiError(403, "You cannot approve your own timesheet");
  if (sheet.status !== "submitted") throw new ApiError(409, "Only submitted timesheets can be reviewed");
  sheet.status = "approved";
  sheet.approvedBy = req.userId;
  sheet.approvedAt = new Date();
  sheet.reviewerNote = req.body?.note || "";
  await sheet.save();
  await notifyTimesheet(sheet.user, weekLabel(sheet.weekStart), "approved");
  return ok(res, { timesheet: { id: String(sheet._id), status: sheet.status } }, "Timesheet approved");
});

export const rejectTimesheet = asyncHandler(async (req, res) => {
  const sheet = await Timesheet.findById(req.params.id);
  if (!sheet) throw new ApiError(404, "Timesheet not found");
  const access = await assertSheetAccess(sheet, req.user);
  if (access === "owner") throw new ApiError(403, "You cannot reject your own timesheet");
  if (sheet.status !== "submitted") throw new ApiError(409, "Only submitted timesheets can be reviewed");
  sheet.status = "rejected";
  sheet.reviewerNote = req.body?.note || "Rejected";
  await sheet.save();
  await notifyTimesheet(sheet.user, weekLabel(sheet.weekStart), "rejected");
  return ok(res, { timesheet: { id: String(sheet._id), status: sheet.status } }, "Timesheet rejected");
});
