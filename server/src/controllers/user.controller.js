import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Timesheet } from "../models/Timesheet.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/pagination.js";
import { created, noContent, ok } from "../utils/response.js";
import { profileSummary, projectToCard, taskToRow, userPublic } from "../utils/serialize.js";

const POPULATE = [
  { path: "department", select: "name" },
  { path: "manager", select: "firstName lastName" },
];

const baseQuery = () => User.find().populate(POPULATE);

/** GET /api/users */
export const listUsers = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { search, role, department, status, sort = "firstName" } = req.query;

  const filter = {};
  const canList = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  if (!canList) {
    if (actor.role === "manager") {
      filter.manager = actor._id;
      filter._id = { $ne: actor._id };
    } else {
      // employees may only see themselves via the list endpoint
      filter._id = actor._id;
    }
  }
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (department) {
    filter.department = mongoose.isValidObjectId(department) ? department : null;
    if (!mongoose.isValidObjectId(department)) filter.$or = undefined;
  }
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { jobTitle: rx }];
  }

  const { page, limit, skip } = paginate(req.query, { defaultLimit: 20, maxLimit: 100 });
  const sortField = String(sort);

  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .populate(POPULATE)
      .sort(sortField)
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return ok(res, {
    items: docs.map(userPublic),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/** GET /api/users/:id */
export const getUser = asyncHandler(async (req, res) => {
  const actor = req.user;
  const targetId = req.params.id;
  const isSelf = String(actor._id) === targetId;
  const isPrivileged = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  if (!isSelf && !isPrivileged && actor.role === "employee") throw new ApiError(403, "You may only view your own profile");
  if (!isSelf && !isPrivileged && actor.role === "manager") {
    const target = await User.findById(targetId).select("manager").lean();
    if (!target || String(target.manager || "") !== String(actor._id)) {
      throw new ApiError(403, "You may only view your direct reports");
    }
  }
  const user = await baseQuery().findById(targetId).lean();
  if (!user) throw new ApiError(404, "User not found");
  return ok(res, { user: userPublic(user) });
});

/** GET /api/users/me/profile (self-profile used by workspace/account) */
export const myProfile = asyncHandler(async (req, res) => {
  const user = await baseQuery().findById(req.userId).lean();
  if (!user) throw new ApiError(404, "User not found");
  return ok(res, { user: profileSummary(user) });
});

/** POST /api/users — admin/hr only */
export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone, role, department, jobTitle, employeeId, manager } = req.body;
  if (await User.findOne({ email: String(email).toLowerCase() })) {
    throw new ApiError(409, "An account with this email already exists");
  }
  const passwordHash = await bcrypt.hash(password || "Welcome123!", 12);
  const payload = {
    firstName,
    lastName,
    email: String(email).toLowerCase(),
    passwordHash,
    phone: phone || "",
    role: role || "employee",
    department: department || null,
    jobTitle: jobTitle || "",
    manager: manager || null,
    status: "active",
  };
  // employeeId is unique-but-optional: only set when a real value is given.
  if (employeeId) payload.employeeId = employeeId;
  const user = await User.create(payload);
  return created(res, { user: userPublic(await baseQuery().findById(user._id).lean()) }, "User created");
});

/** PATCH /api/users/:id */
export const updateUser = asyncHandler(async (req, res) => {
  const actor = req.user;
  const targetId = req.params.id;
  const target = await User.findById(targetId);
  if (!target) throw new ApiError(404, "User not found");

  const isSelf = String(target._id) === String(actor._id);
  const privileged = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  const isMyReport = actor.role === "manager" && String(target.manager || "") === String(actor._id);

  if (!isSelf && !privileged && !isMyReport) throw new ApiError(403, "You cannot edit this user");

  const editable = privileged
    ? ["firstName", "lastName", "phone", "avatar", "location", "skills", "emergencyContact", "role", "department", "jobTitle", "employeeId", "manager", "status", "notificationPrefs"]
    : ["firstName", "lastName", "phone", "avatar", "location", "skills", "emergencyContact", "notificationPrefs"];

  if (!privileged && (req.body.role || req.body.status || req.body.employeeId)) {
    throw new ApiError(403, "You may only edit your own profile fields");
  }

  const updates = {};
  for (const key of editable) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return ok(res, { user: userPublic(target) }, "No changes");
  if ("employeeId" in updates && !updates.employeeId) delete updates.employeeId; // keep the sparse-unique index clean

  const updated = await User.findByIdAndUpdate(targetId, updates, { new: true }).populate(POPULATE).lean();
  return ok(res, { user: userPublic(updated) }, "User updated");
});

/** PATCH /api/users/me — own profile fields (non-privileged route guard above allows self) */
export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ["firstName", "lastName", "phone", "avatar", "location", "skills", "emergencyContact", "notificationPrefs"];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  const updated = await User.findByIdAndUpdate(req.userId, updates, { new: true }).populate(POPULATE).lean();
  return ok(res, { user: profileSummary(updated) }, "Profile updated");
});

/** PATCH /api/users/me/password */
export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.userId).select("+passwordHash");
  if (!user) throw new ApiError(404, "User not found");
  const valid = await bcrypt.compare(String(currentPassword || ""), user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect");
  user.passwordHash = await bcrypt.hash(String(newPassword), 12);
  await user.save();
  return ok(res, null, "Password changed");
});

/** DELETE /api/users/:id — admin/hr only */
export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.userId)) throw new ApiError(400, "You cannot delete your own account");
  const target = await User.findByIdAndDelete(req.params.id);
  if (!target) throw new ApiError(404, "User not found");
  return noContent(res);
});

/** GET /api/users/:id/tasks (id may be 'me') */
export const userTasks = asyncHandler(async (req, res) => {
  const targetId = req.params.id === "me" ? req.userId : req.params.id;
  const actor = req.user;
  const isSelf = String(actor._id) === targetId;
  const privileged = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  if (!isSelf && !privileged && actor.role !== "manager") throw new ApiError(403, "Forbidden");
  const tasks = await Task.find({ assignedTo: targetId })
    .populate("project", "name")
    .populate("assignedTo", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, { items: tasks.map((t) => taskToRow(t)) });
});

/** GET /api/users/:id/projects (id may be 'me') */
export const userProjects = asyncHandler(async (req, res) => {
  const targetId = req.params.id === "me" ? req.userId : req.params.id;
  const actor = req.user;
  const isSelf = String(actor._id) === targetId;
  const privileged = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  if (!isSelf && !privileged && actor.role !== "manager") throw new ApiError(403, "Forbidden");
  const projects = await Project.find({ members: targetId }).populate("members", "firstName lastName jobTitle").sort({ updatedAt: -1 }).lean();
  return ok(res, { items: projects.map(projectToCard) });
});

/** GET /api/users/:id/timesheets (id may be 'me') */
export const userTimesheets = asyncHandler(async (req, res) => {
  const targetId = req.params.id === "me" ? req.userId : req.params.id;
  const actor = req.user;
  const isSelf = String(actor._id) === targetId;
  const privileged = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  if (!isSelf && !privileged && actor.role !== "manager") throw new ApiError(403, "Forbidden");
  const sheets = await Timesheet.find({ user: targetId }).sort({ weekStart: -1 }).lean();
  return ok(res, { items: sheets });
});
