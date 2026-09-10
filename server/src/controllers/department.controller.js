import { Department } from "../models/Department.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, noContent, ok } from "../utils/response.js";

const POP = [
  { path: "manager", select: "firstName lastName jobTitle" },
  { path: "members", select: "firstName lastName jobTitle" },
];

export const listDepartments = asyncHandler(async (_req, res) => {
  const depts = await Department.find().populate(POP).sort({ name: 1 }).lean();
  return ok(res, {
    items: depts.map((d) => ({
      id: String(d._id),
      name: d.name,
      description: d.description,
      manager: d.manager ? { id: String(d.manager._id), name: `${d.manager.firstName} ${d.manager.lastName}` } : null,
      members: (d.members || []).map((m) => ({ id: String(m._id), name: `${m.firstName} ${m.lastName}` })),
      status: d.status,
    })),
  });
});

export const getDepartment = asyncHandler(async (req, res) => {
  const d = await Department.findById(req.params.id).populate(POP).lean();
  if (!d) throw new ApiError(404, "Department not found");
  return ok(res, {
    department: {
      id: String(d._id),
      name: d.name,
      description: d.description,
      manager: d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : "",
      status: d.status,
    },
  });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description, manager } = req.body;
  const dept = await Department.create({ name, description: description || "", manager: manager || null });
  return created(res, { department: dept }, "Department created");
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!dept) throw new ApiError(404, "Department not found");
  return ok(res, { department: dept }, "Department updated");
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw new ApiError(404, "Department not found");
  const members = await User.countDocuments({ department: dept._id });
  if (members > 0) throw new ApiError(409, "Department still has members; reassign them first");
  await dept.deleteOne();
  return noContent(res);
});
