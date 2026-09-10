import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { avatarColor, initialsOf } from "../utils/serialize.js";

/** department name -> org filter key used by the design's department filter. */
function deptKey(deptName = "") {
  const name = String(deptName).toLowerCase();
  if (name.includes("engineering") || name.includes("design") || name.includes("product") || name.includes("tech")) return "engineering";
  if (name.includes("market") || name.includes("sales")) return "marketing";
  if (name.includes("leadership") || name.includes("executive") || name.includes("office")) return "leadership";
  return name.replace(/[^a-z]/g, "");
}

/** GET /api/org-chart — management tree (root → managers → direct reports). */
export const orgChart = asyncHandler(async (_req, res) => {
  const users = await User.find({ orgHidden: { $ne: true } })
    .populate("department", "name")
    .select("firstName lastName jobTitle department manager role")
    .lean();

  const byId = new Map();
  for (const u of users) {
    byId.set(String(u._id), { ...u, children: [] });
  }

  let rootId = null;
  for (const u of users) {
    const id = String(u._id);
    const node = byId.get(id);
    const managerId = u.manager ? String(u.manager) : null;
    if (!managerId) {
      if (!rootId) rootId = id;
      continue;
    }
    const parent = byId.get(managerId);
    if (parent) parent.children.push(node);
    else if (!rootId) rootId = id;
  }

  const fullName = (u) => `${u.firstName} ${u.lastName}`.trim();
  const nodeView = (u) => ({
    id: String(u._id),
    initials: initialsOf(fullName(u)),
    name: fullName(u),
    role: u.jobTitle || "",
    color: avatarColor(String(u._id)),
    dept: deptKey(u.department?.name || ""),
  });

  const build = (node, depth) => {
    const view = nodeView(node);
    if (node.children.length > 0 && depth < 2) {
      view.reports = node.children.map((c) => String(c._id));
      view.reportsCount = node.children.length;
    }
    return view;
  };

  if (!rootId) return ok(res, { root: null, nodes: {} });

  const root = byId.get(rootId);
  const nodes = {};
  const visit = (node, depth) => {
    if (depth > 2) return;
    nodes[String(node._id)] = build(node, depth);
    if (node.children.length > 0 && depth < 2) {
      for (const child of node.children) visit(child, depth + 1);
    }
  };
  visit(root, 0);

  return ok(res, {
    root: nodes[String(root._id)],
    nodes,
  });
});
