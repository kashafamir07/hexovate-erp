import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { noContent, ok } from "../utils/response.js";
import { notificationToItem } from "../utils/serialize.js";

/** GET /api/notifications — the current user's notifications (newest first). */
export const listNotifications = asyncHandler(async (req, res) => {
  const { unread, limit = 30 } = req.query;
  const filter = { user: req.userId };
  if (unread === "true" || unread === "1") filter.read = false;
  const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Number(limit) || 30)).lean();
  const items = docs.map((n) => notificationToItem(n));
  const unreadCount = await Notification.countDocuments({ user: req.userId, read: false });
  return ok(res, { items, unread: unreadCount });
});

/** PATCH /api/notifications/:id/read */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { read: true },
    { new: true }
  ).lean();
  if (!n) throw new ApiError(404, "Notification not found");
  return ok(res, { notification: notificationToItem(n) }, "Marked read");
});

/** PATCH /api/notifications/read-all */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ user: req.userId, read: false }, { read: true });
  return ok(res, { marked: result.modifiedCount }, "All notifications marked read");
});

/** DELETE /api/notifications/:id */
export const deleteNotification = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!n) throw new ApiError(404, "Notification not found");
  return noContent(res);
});
