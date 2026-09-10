import { Notification } from "../models/Notification.js";

/**
 * Create a notification for one user (or a list of users).
 * Returns the created document when `one` user is given.
 */
export async function notify({ users, type, title, message, relatedEntity = null }) {
  const targets = Array.isArray(users) ? users : [users];
  const docs = targets
    .filter(Boolean)
    .map((userId) => ({ user: userId, type, title, message, relatedEntity }));
  if (docs.length === 0) return null;
  const inserted = await Notification.insertMany(docs);
  return targets.length === 1 ? inserted[0] : inserted;
}

export const notifyTaskAssignment = (assigneeId, taskTitle, byName) =>
  notify({
    users: assigneeId,
    type: "task",
    title: "Task assigned to you",
    message: `${byName} assigned "${taskTitle}"`,
  });

export const notifyRequestDecision = (requesterId, requestTitle, decision) =>
  notify({
    users: requesterId,
    type: "approval",
    title: `Request ${decision}`,
    message: `${requestTitle} was ${decision}`,
  });

export const notifyAnnouncement = (userIds, title) =>
  notify({
    users: userIds,
    type: "announcement",
    title: "New announcement",
    message: title,
  });

export const notifyTimesheet = (userId, weekLabel, action) =>
  notify({
    users: userId,
    type: "timesheet",
    title: `Timesheet ${action}`,
    message: `Your timesheet for ${weekLabel} was ${action}`,
  });
