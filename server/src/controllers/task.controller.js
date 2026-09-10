import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { created, noContent, ok } from "../utils/response.js";
import { notifyTaskAssignment } from "../services/notification.service.js";
import { personFromUser, statusFromLabel, taskToRow } from "../utils/serialize.js";

const TASK_POP = [
  { path: "project", select: "name" },
  { path: "assignedTo", select: "firstName lastName jobTitle" },
  { path: "createdBy", select: "firstName lastName" },
];

const mapStatus = (s) => statusFromLabel[s] || s;
const mapPriority = (p) => ({ High: "high", Medium: "medium", Low: "low" }[p] || p);
const uiPriority = (p) => ({ high: "High", medium: "Medium", low: "Low" }[p] || p);

/** Access rules for a single task (read or write). */
async function loadTaskFor(actor, taskId, { write } = {}) {
  const task = await Task.findById(taskId).populate(TASK_POP).lean();
  if (!task) throw new ApiError(404, "Task not found");
  const privileged = actor.role === "admin" || actor.role === "hr";
  const assigned = task.assignedTo && String(task.assignedTo._id || task.assignedTo) === String(actor._id);
  const created = task.createdBy && String(task.createdBy._id || task.createdBy) === String(actor._id);
  if (!privileged && !assigned && !created && actor.role !== "manager") {
    throw new ApiError(403, "You can only access tasks assigned to you");
  }
  return task;
}

/** GET /api/tasks — employee view: own tasks by default; privileged roles can query everyone's. */
export const listTasks = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { search, project, status, priority, assigned, due, sort = "createdAt" } = req.query;
  const filter = {};
  const privileged = actor.role === "admin" || actor.role === "hr";

  if (assigned === "me" || (!privileged && actor.role === "employee" && !project)) {
    filter.assignedTo = actor._id;
  } else if (assigned && assigned !== "all") {
    if (assigned !== "me" && !privileged && actor.role !== "manager") throw new ApiError(403, "Forbidden");
    filter.assignedTo = assigned === "me" ? actor._id : assigned;
  } else if (assigned === "all" && !privileged && actor.role !== "manager") {
    filter.assignedTo = actor._id;
  }

  if (project) filter.project = project;
  if (status) filter.status = mapStatus(status);
  if (priority) filter.priority = mapPriority(priority);
  if (due === "today") filter.dueDate = { $gte: startToday(), $lt: startTodayPlus(1) };
  if (due === "overdue") filter.dueDate = { $lt: new Date(), $ne: null };
  if (due === "week") {
    const start = startToday();
    filter.dueDate = { $gte: start, $lt: new Date(start.getTime() + 7 * 86400000) };
  }
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { description: rx }];
  }

  const { page, limit, skip } = paginate(req.query, { defaultLimit: 50, maxLimit: 200 });
  const sortField = ["dueDate", "priority", "createdAt", "updatedAt"].includes(String(sort)) ? String(sort) : "createdAt";

  const [total, docs] = await Promise.all([
    Task.countDocuments(filter),
    Task.find(filter).populate(TASK_POP).sort(sortField).skip(skip).limit(limit).lean(),
  ]);
  return ok(res, { items: docs.map((t) => taskToRow(t)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

function startToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startTodayPlus(n) {
  const d = startToday();
  d.setDate(d.getDate() + n);
  return d;
}

export const getTask = asyncHandler(async (req, res) => {
  const task = await loadTaskFor(req.user, req.params.id);
  const assignee = task.assignedTo && typeof task.assignedTo === "object" ? task.assignedTo : null;
  return ok(res, {
    task: {
      ...taskToRow(task),
      description: task.description || "",
      assignee: assignee ? personFromUser(assignee) : null,
      labels: task.labels || [],
      createdAt: task.createdAt,
    },
  });
});

export const createTask = asyncHandler(async (req, res) => {
  const actor = req.user;
  const privileged = actor.role === "admin" || actor.role === "hr" || actor.role === "manager";
  const { title, description, project, assignedTo, priority, dueDate, labels, status } = req.body;

  let proj = null;
  if (project) {
    proj = await Project.findById(project);
    if (!proj) throw new ApiError(404, "Project not found");
    const isMember = (proj.members || []).some((m) => String(m) === String(actor._id));
    if (!privileged && !isMember && String(proj.owner || "") !== String(actor._id)) {
      throw new ApiError(403, "You are not a member of this project");
    }
  }

  const task = await Task.create({
    title,
    description: description || "",
    project: project || null,
    assignedTo: assignedTo || (actor.role === "employee" ? actor._id : null),
    createdBy: actor._id,
    priority: mapPriority(priority) || "medium",
    dueDate: dueDate || null,
    labels: labels || [],
    status: mapStatus(status) || "todo",
  });

  if (assignedTo && String(assignedTo) !== String(actor._id)) {
    await notifyTaskAssignment(assignedTo, title, `${actor.firstName} ${actor.lastName}`);
  }

  const full = await Task.findById(task._id).populate(TASK_POP).lean();
  return created(res, { task: taskToRow(full) }, "Task created");
});

export const updateTask = asyncHandler(async (req, res) => {
  const actor = req.user;
  const task = await loadTaskFor(actor, req.params.id, { write: true });
  const allowed = ["title", "description", "project", "assignedTo", "priority", "dueDate", "labels", "status"];
  const updates = {};
  const privileged = actor.role === "admin" || actor.role === "hr" || actor.role === "manager";
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (key === "status") {
      const next = mapStatus(req.body[key]);
      updates.status = next;
      updates.completedAt = next === "completed" ? new Date() : null;
    } else if (key === "priority") {
      updates.priority = mapPriority(req.body[key]);
    } else if (key === "assignedTo" && !privileged) {
      throw new ApiError(403, "Only managers and admins can reassign tasks");
    } else {
      updates[key] = req.body[key];
    }
  }
  if (updates.assignedTo && String(updates.assignedTo) !== String(task.assignedTo?._id || "")) {
    await notifyTaskAssignment(updates.assignedTo, task.title, `${actor.firstName} ${actor.lastName}`);
  }
  const updated = await Task.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(TASK_POP).lean();
  return ok(res, { task: taskToRow(updated) }, "Task updated");
});

export const deleteTask = asyncHandler(async (req, res) => {
  const actor = req.user;
  await loadTaskFor(actor, req.params.id, { write: true });
  await Task.findByIdAndDelete(req.params.id);
  return noContent(res);
});

/** PATCH /api/tasks/:id/status */
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const next = mapStatus(status);
  if (!next) throw new ApiError(422, "Unknown status", [{ field: "status", msg: "Unknown status" }]);
  const task = await loadTaskFor(req.user, req.params.id, { write: true });
  const updates = { status: next, completedAt: next === "completed" ? new Date() : null };
  const updated = await Task.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(TASK_POP).lean();
  return ok(res, { task: taskToRow(updated) }, "Status updated");
});

/** PATCH /api/tasks/:id/complete */
export const completeTask = asyncHandler(async (req, res) => {
  const task = await loadTaskFor(req.user, req.params.id, { write: true });
  const done = req.body.done !== false;
  const updated = await Task.findByIdAndUpdate(
    req.params.id,
    { status: done ? "completed" : "todo", completedAt: done ? new Date() : null },
    { new: true }
  ).populate(TASK_POP).lean();
  return ok(res, { task: taskToRow(updated) }, done ? "Task completed" : "Task reopened");
});
