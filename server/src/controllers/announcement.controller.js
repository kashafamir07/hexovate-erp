import { Announcement } from "../models/Announcement.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, noContent, ok } from "../utils/response.js";
import { notifyAnnouncement } from "../services/notification.service.js";
import { announcementRow } from "../utils/serialize.js";

const A_POP = { path: "author", select: "firstName lastName" };

/** Audience rule: 'all' or a tag matching the user's department. */
function audienceAllowed(audience, actor) {
  if (audience === "all") return true;
  const deptKey = String((actor.departmentName || "").toLowerCase().replace(/[^a-z]/g, ""));
  if (audience === deptKey) return true;
  if (audience === "leadership" && ["admin", "manager", "ceo", "company_admin", "super_admin"].includes(actor.role)) return true;
  if (audience === "hr" && actor.role === "hr") return true;
  return false;
}

async function actorWithDept(actor) {
  const me = await User.findById(actor._id).populate("department", "name").select("role department").lean();
  return { ...actor, departmentName: me?.department?.name || "" };
}

export const listAnnouncements = asyncHandler(async (req, res) => {
  const actor = await actorWithDept(req.user);
  const now = new Date();
  const filter = {
    status: "published",
    publishedAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
  const docs = await Announcement.find(filter)
    .populate(A_POP)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const visible = docs.filter((a) => audienceAllowed(a.audience, actor));
  const pinnedFirst = [...visible].sort((a, b) => {
    const aPin = a.priority === "important" || a.priority === "urgent" ? 1 : 0;
    const bPin = b.priority === "important" || b.priority === "urgent" ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);
  });
  return ok(res, { items: pinnedFirst.map((a) => announcementRow(a, now)) });
});

export const getAnnouncement = asyncHandler(async (req, res) => {
  const actor = await actorWithDept(req.user);
  const a = await Announcement.findById(req.params.id).populate(A_POP).lean();
  if (!a) throw new ApiError(404, "Announcement not found");
  if (a.status === "draft" && !["admin", "hr", "ceo", "company_admin", "super_admin"].includes(actor.role)) throw new ApiError(404, "Announcement not found");
  if (!audienceAllowed(a.audience, actor) && a.status !== "draft") throw new ApiError(403, "Not intended for you");
  return ok(res, { announcement: announcementRow(a) });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, audience = "all", priority = "normal", expiresAt } = req.body;
  const a = await Announcement.create({
    title,
    content,
    author: req.userId,
    audience,
    priority,
    status: "published",
    publishedAt: new Date(),
    expiresAt: expiresAt || null,
  });
  if (audience === "all") {
    const users = await User.find({ status: "active", _id: { $ne: req.userId } }).select("_id").lean();
    await notifyAnnouncement(users.map((u) => u._id), title);
  }
  const full = await Announcement.findById(a._id).populate(A_POP).lean();
  return created(res, { announcement: announcementRow(full) }, "Announcement published");
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const allowed = ["title", "content", "audience", "priority", "status", "expiresAt", "publishedAt"];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  const a = await Announcement.findByIdAndUpdate(req.params.id, updates, { new: true }).populate(A_POP).lean();
  if (!a) throw new ApiError(404, "Announcement not found");
  return ok(res, { announcement: announcementRow(a) }, "Announcement updated");
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findByIdAndDelete(req.params.id);
  if (!a) throw new ApiError(404, "Announcement not found");
  return noContent(res);
});
