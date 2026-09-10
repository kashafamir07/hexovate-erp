import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { TimeEntry } from "../models/TimeEntry.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { created, noContent, ok } from "../utils/response.js";
import { currentTimerView, timeEntryToRow } from "../utils/serialize.js";
import { weekStart } from "../utils/ui.js";

const TIME_POP = [
  { path: "project", select: "name" },
  { path: "task", select: "title" },
];

const toDate = (v) => (v ? new Date(v) : null);

/** POST /api/time/start — one active timer per user. */
export const startTimer = asyncHandler(async (req, res) => {
  const { project, task, taskName, description, billable = true } = req.body;
  const existing = await TimeEntry.findOne({ user: req.userId, status: "running" });
  if (existing) throw new ApiError(409, "A timer is already running for this user");

  let proj = null;
  let taskDoc = null;
  if (project) {
    proj = await Project.findById(project);
    if (!proj) throw new ApiError(404, "Project not found");
  }
  if (task) {
    taskDoc = await Task.findById(task);
    if (!taskDoc) throw new ApiError(404, "Task not found");
  }

  const entry = await TimeEntry.create({
    user: req.userId,
    project: proj ? proj._id : null,
    projectName: proj ? proj.name : "",
    task: taskDoc ? taskDoc._id : null,
    taskName: taskDoc ? taskDoc.title : taskName || "",
    description: description || "",
    date: new Date(),
    startTime: new Date(),
    endTime: null,
    duration: 0,
    billable: Boolean(billable),
    status: "running",
    manual: false,
  });
  const full = await TimeEntry.findById(entry._id).populate(TIME_POP).lean();
  return created(res, { timer: currentTimerView(full) }, "Timer started");
});

/** POST /api/time/stop */
export const stopTimer = asyncHandler(async (req, res) => {
  const entry = await TimeEntry.findOne({ user: req.userId, status: "running" }).populate(TIME_POP);
  if (!entry) throw new ApiError(404, "No running timer");
  const end = new Date();
  const minutes = Math.max(1, Math.round((end.getTime() - entry.startTime.getTime()) / 60000));
  entry.endTime = end;
  entry.duration = minutes;
  entry.status = "stopped";
  await entry.save();
  return ok(res, { entry: timeEntryToRow(entry.toObject()) }, "Timer stopped");
});

/** GET /api/time/current */
export const getCurrent = asyncHandler(async (req, res) => {
  const running = await TimeEntry.findOne({ user: req.userId, status: "running" }).populate(TIME_POP).lean();
  return ok(res, { current: currentTimerView(running) });
});

/** GET /api/time — entries with date range filters (frontend Time Tracker list). */
export const listTime = asyncHandler(async (req, res) => {
  const { scope = "week", project, billable, from, to } = req.query;
  const filter = { user: req.userId };
  if (project && project !== "all") filter.project = project;
  if (billable === "true" || billable === "1") filter.billable = true;
  if (billable === "false" || billable === "0") filter.billable = false;

  const today = new Date();
  if (scope === "week") {
    filter.date = { $gte: weekStart(today) };
  } else if (scope === "month") {
    filter.date = { $gte: new Date(today.getFullYear(), today.getMonth(), 1) };
  }
  if (from) filter.date = { ...(filter.date || {}), $gte: new Date(from) };
  if (to) filter.date = { ...(filter.date || {}), $lte: new Date(to) };

  const { page, limit, skip } = paginate(req.query, { defaultLimit: 100, maxLimit: 200 });
  const [total, docs] = await Promise.all([
    TimeEntry.countDocuments(filter),
    TimeEntry.find(filter).populate(TIME_POP).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return ok(res, { items: docs.map(timeEntryToRow), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

/** GET /api/time/summary */
export const timeSummary = asyncHandler(async (req, res) => {
  const { scope = "week" } = req.query;
  const today = new Date();
  const from = scope === "month" ? new Date(today.getFullYear(), today.getMonth(), 1) : scope === "all" ? null : weekStart(today);
  const filter = { user: req.userId, status: "stopped" };
  if (from) filter.date = { $gte: from };

  const entries = await TimeEntry.find(filter).lean();
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const billableMinutes = entries.filter((e) => e.billable).reduce((sum, e) => sum + (e.duration || 0), 0);
  const byProject = {};
  for (const e of entries) {
    const key = e.projectName || "Internal";
    byProject[key] = (byProject[key] || 0) + (e.duration || 0);
  }
  const byDay = {};
  for (const e of entries) {
    if (!e.date) continue;
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    byDay[key] = (byDay[key] || 0) + (e.duration || 0);
  }
  return ok(res, {
    summary: {
      scope,
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
      hours: totalMinutes / 60,
      byProject: Object.entries(byProject).map(([project, minutes]) => ({ project, minutes })).sort((a, b) => b.minutes - a.minutes),
      byDay: Object.entries(byDay).map(([date, minutes]) => ({ date, minutes })),
    },
  });
});

/** PATCH /api/time/:id */
export const updateTime = asyncHandler(async (req, res) => {
  const entry = await TimeEntry.findOne({ _id: req.params.id, user: req.userId });
  if (!entry) throw new ApiError(404, "Time entry not found");
  const allowed = ["project", "task", "taskName", "description", "billable", "duration", "date"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (key === "project" && req.body[key]) {
      const proj = await Project.findById(req.body[key]);
      if (!proj) throw new ApiError(404, "Project not found");
      updates.project = proj._id;
      updates.projectName = proj.name;
    } else {
      updates[key] = req.body[key];
    }
  }
  const updated = await TimeEntry.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(TIME_POP).lean();
  return ok(res, { entry: timeEntryToRow(updated) }, "Time entry updated");
});

/** DELETE /api/time/:id */
export const deleteTime = asyncHandler(async (req, res) => {
  const entry = await TimeEntry.findOne({ _id: req.params.id, user: req.userId });
  if (!entry) throw new ApiError(404, "Time entry not found");
  await entry.deleteOne();
  return noContent(res);
});

/** POST /api/time (manual entry) */
export const createManualEntry = asyncHandler(async (req, res) => {
  const { project, task, taskName, date, duration, minutes, billable = true, description } = req.body;
  let proj = null;
  if (project) {
    proj = await Project.findById(project);
    if (!proj) throw new ApiError(404, "Project not found");
  }
  const entry = await TimeEntry.create({
    user: req.userId,
    project: proj ? proj._id : null,
    projectName: proj ? proj.name : "",
    task: task || null,
    taskName: taskName || (task ? "" : ""),
    description: description || "",
    date: toDate(date) || new Date(),
    startTime: toDate(date) || null,
    endTime: null,
    duration: Math.max(1, Number(minutes ?? duration ?? 0)),
    billable: Boolean(billable),
    status: "stopped",
    manual: true,
  });
  const full = await TimeEntry.findById(entry._id).populate(TIME_POP).lean();
  return created(res, { entry: timeEntryToRow(full) }, "Time entry saved");
});
