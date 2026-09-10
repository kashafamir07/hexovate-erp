import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { created, noContent, ok } from "../utils/response.js";
import { personFromUser, projectToCard, projectToDetail, statusLabel, taskToBoardCard } from "../utils/serialize.js";
import { relTime } from "../utils/ui.js";

const MEMBER_POP = { path: "members", select: "firstName lastName jobTitle" };
const OWNER_POP = { path: "owner", select: "firstName lastName" };

function memberIds(project) {
  return (project.members || []).map((m) => String(m._id || m));
}

export function canManageProject(actor, project) {
  if (actor.role === "admin" || actor.role === "hr") return true;
  if (actor.role !== "manager") return false;
  if (project.owner && String(project.owner._id || project.owner) === String(actor._id)) return true;
  return memberIds(project).includes(String(actor._id));
}

export const listProjects = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { search, status, priority, mine, sort = "updatedAt" } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (mine === "true" || mine === "1") {
    filter.$or = [{ members: actor._id }, { owner: actor._id }];
  }
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [...(filter.$or || []), { name: rx }, { description: rx }];
  }
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [total, docs] = await Promise.all([
    Project.countDocuments(filter),
    Project.find(filter).populate(MEMBER_POP).populate(OWNER_POP).sort(sort).skip(skip).limit(limit).lean(),
  ]);
  return ok(res, { items: docs.map(projectToCard), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate(MEMBER_POP).populate(OWNER_POP).lean();
  if (!project) throw new ApiError(404, "Project not found");
  const tasks = await Task.find({ project: project._id })
    .populate("assignedTo", "firstName lastName")
    .populate("project", "name")
    .sort({ createdAt: -1 })
    .lean();
  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    inReview: tasks.filter((t) => t.status === "review").length,
    overdue: tasks.filter((t) => t.dueDate && t.dueDate < new Date() && t.status !== "completed").length,
  };
  const activity = tasks.slice(0, 4).map((t) => {
    const who = t.assignedTo && typeof t.assignedTo === "object" ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`.trim() : null;
    const verb = t.status === "completed" ? "completed" : "updated";
    return { text: who ? `${who} ${verb} ${t.title}` : `${t.title} was ${verb}`, time: t.updatedAt ? relTime(t.updatedAt) : "" };
  });
  return ok(res, {
    project: {
      ...projectToDetail(project),
      budget: {
        spent: project.spent || 0,
        total: project.budget || 0,
        pct: project.budget ? Math.min(100, Math.round(((project.spent || 0) / project.budget) * 100)) : 0,
      },
    },
    stats,
    activity,
  });
});

export const createProject = asyncHandler(async (req, res) => {
  const { name, description, status, priority, owner, members, startDate, dueDate, budget, spent } = req.body;
  const project = await Project.create({
    name,
    description: description || "",
    status: status || "active",
    priority: priority || "medium",
    owner: owner || req.userId,
    members: members || [],
    startDate: startDate || null,
    dueDate: dueDate || null,
    budget: budget || 0,
    spent: spent || 0,
  });
  return created(res, { project: projectToCard(await Project.findById(project._id).populate(MEMBER_POP).populate(OWNER_POP).lean()) }, "Project created");
});

export const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate(MEMBER_POP).populate(OWNER_POP).lean();
  if (!project) throw new ApiError(404, "Project not found");
  const allowed = ["name", "description", "status", "priority", "owner", "members", "startDate", "dueDate", "budget", "spent", "progress"];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  const updated = await Project.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(MEMBER_POP).populate(OWNER_POP).lean();
  return ok(res, { project: projectToDetail(updated) }, "Project updated");
});

export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, "Project not found");
  await Task.deleteMany({ project: project._id });
  await project.deleteOne();
  return noContent(res);
});

/** POST /api/projects/:id/members */
export const addProjectMember = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, "Project not found");
  const { userId } = req.body;
  const member = await User.findById(userId);
  if (!member) throw new ApiError(404, "User not found");
  const current = memberIds(project);
  if (!current.includes(String(userId))) {
    project.members.push(userId);
    await project.save();
  }
  return ok(res, { members: await projectMembers(project._id) }, "Member added");
});

/** DELETE /api/projects/:id/members/:userId */
export const removeProjectMember = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, "Project not found");
  const before = project.members.length;
  project.members = project.members.filter((m) => String(m) !== String(req.params.userId));
  if (project.members.length === before) throw new ApiError(404, "Member not on this project");
  await project.save();
  return ok(res, { members: await projectMembers(project._id) }, "Member removed");
});

async function projectMembers(projectId) {
  const project = await Project.findById(projectId).populate(MEMBER_POP).lean();
  return (project.members || []).map((m) => personFromUser(m));
}

/** GET /api/projects/:id/board — kanban grouped by status (frontend board shape). */
export const getProjectBoard = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate(MEMBER_POP).lean();
  if (!project) throw new ApiError(404, "Project not found");
  const tasks = await Task.find({ project: project._id })
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: 1 })
    .lean();

  const statuses = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
  const buckets = Object.fromEntries(statuses.map((s) => [s, []]));
  for (const t of tasks) {
    const label = t.status === "completed" ? "Done" : statusLabel[t.status];
    const card = taskToBoardCard(t);
    card.status = t.status;
    const key = label === "To Do" && t.labels?.includes("backlog") ? "Backlog" : label;
    (buckets[key] || buckets["To Do"]).push(card);
  }
  const columns = statuses
    .filter((s) => buckets[s].length > 0)
    .map((s) => ({ status: s, tasks: buckets[s] }));

  // Counts match card presence (exact per column).
  const columnCount = Object.fromEntries(columns.map((c) => [c.status, c.tasks.length]));
  return ok(res, {
    project: { id: String(project._id), name: project.name },
    columns,
    columnCount,
  });
});
