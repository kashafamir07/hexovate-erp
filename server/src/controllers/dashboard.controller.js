import { Announcement } from "../models/Announcement.js";
import { Notification } from "../models/Notification.js";
import { Project } from "../models/Project.js";
import { Request } from "../models/Request.js";
import { Task } from "../models/Task.js";
import { TimeEntry } from "../models/TimeEntry.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { avatarColor, initialsOf } from "../utils/serialize.js";
import { addDays, isSameDay, relTime, startOfDay, uiTime, weekStart } from "../utils/ui.js";

const TONE = { high: "danger", medium: "warning", low: "success" };
const PRIORITY = { high: "High", medium: "Med", low: "Low" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const metaOf = (t) => {
  if (!t.dueDate) return "By EOD";
  const d = new Date(t.dueDate);
  if (d.getHours() >= 22) return "By EOD";
  return uiTime(d);
};

/** GET /api/dashboard — widget payload shaped exactly for the existing UI. */
export const dashboard = asyncHandler(async (req, res) => {
  const me = await User.findById(req.userId).populate("department", "name").lean();
  if (!me) throw notFound();
  const now = new Date();
  const today = startOfDay(now);
  const weekStartDate = weekStart(now);

  const [myTasks, myProjects, myRequests, unreadNotifs, notifications, runningEntries] = await Promise.all([
    Task.find({ assignedTo: me._id }).populate("project", "name").populate("createdBy", "firstName lastName").sort({ dueDate: 1, createdAt: -1 }).lean(),
    Project.find({ members: me._id, status: { $in: ["active", "on_hold"] } }).sort({ updatedAt: -1 }).limit(3).lean(),
    Request.find({ requester: me._id, status: "pending" }).countDocuments(),
    Notification.countDocuments({ user: me._id, read: false }),
    Notification.find({ user: me._id }).sort({ createdAt: -1 }).limit(6).lean(),
    TimeEntry.find({ user: me._id, status: "running" }).lean(),
  ]);

  const completedMine = myTasks.filter((t) => t.status === "completed");
  const completedToday = completedMine.filter((t) => t.completedAt && isSameDay(t.completedAt, now));
  const dueSoon = myTasks.filter((t) => t.dueDate && t.status !== "completed" && startOfDay(t.dueDate) >= today).sort((a, b) => a.dueDate - b.dueDate);
  const pendingTop = dueSoon[0] || myTasks.filter((t) => t.status !== "completed")[0];

  // Today's Tasks: completed-today first (checked), then the next pending one.
  const todaysTasks = [
    ...completedToday.slice(0, 2).map((t) => ({
      title: t.title,
      meta: metaOf(t),
      priority: TONE[t.priority],
      priorityLabel: PRIORITY[t.priority],
      checked: true,
    })),
  ];
  if (pendingTop) {
    todaysTasks.push({
      title: pendingTop.title,
      meta: metaOf(pendingTop),
      priority: TONE[pendingTop.priority],
      priorityLabel: PRIORITY[pendingTop.priority],
      checked: false,
    });
  }

  const activeProjects = myProjects.map((p) => ({
    name: p.name,
    meta: relTime(p.updatedAt, now),
    progress: p.progress ?? 0,
    pctLabel: `${p.progress ?? 0}% complete`,
    mobilePct: `${p.progress ?? 0}%`,
  }));

  // Activity: recent notifications + team events, shaped as avatar rows.
  const activity = [];
  const pushActivity = (item) => {
    if (activity.length < 4) activity.push(item);
  };
  for (const n of notifications) {
    const { initials, color, text, accent } = activityFromNotification(n);
    pushActivity({ initials, color, text, accent, time: relTime(n.createdAt, now) });
  }
  if (activity.length === 0) {
    const entries = await TimeEntry.find({ user: me._id, status: "stopped" }).sort({ endTime: -1 }).limit(2).lean();
    for (const e of entries) {
      pushActivity({ initials: initialsOf(`${me.firstName} ${me.lastName}`), color: avatarColor(String(me._id)), text: `Logged ${e.projectName || "time"}`, accent: e.taskName, time: e.endTime ? relTime(e.endTime, now) : "" });
    }
  }

  // Time stats (this week vs last week).
  const weekEntries = await TimeEntry.find({ user: me._id, status: "stopped", date: { $gte: weekStartDate } }).lean();
  const lastWeekEntries = await TimeEntry.find({ user: me._id, status: "stopped", date: { $gte: addDays(weekStartDate, -7), $lt: weekStartDate } }).lean();
  const sumMin = (list) => list.reduce((s, e) => s + (e.duration || 0), 0);
  const weekMins = sumMin(weekEntries);
  const lastWeekMins = sumMin(lastWeekEntries);
  const weekHours = Math.round((weekMins / 60) * 10) / 10;
  let badge;
  if (lastWeekMins > 0) {
    const delta = Math.round(((weekMins - lastWeekMins) / lastWeekMins) * 100);
    if (delta !== 0) badge = `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs last week`;
  }
  const leaveDays = me.leaveBalanceDays ?? 14;

  const statItems = [
    { value: String(completedMine.length), label: "Tasks Completed", badge },
    { value: String(weekHours), label: "Hours Logged This Week" },
    { value: `${leaveDays} Days`, label: "Annual Leave Balance" },
  ].filter(Boolean);

  const upcomingDeadlines = dueSoon.slice(0, 2).map((t) => {
    const days = Math.ceil((startOfDay(t.dueDate).getTime() - today.getTime()) / 86400000);
    return {
      task: t.title,
      project: t.project && typeof t.project === "object" ? t.project.name : "",
      due: days <= 0 ? "today" : `${days} ${days === 1 ? "day" : "days"}`,
    };
  });

  const teammates = await teamOf(me, now);
  const teamOnline = teammates.slice(0, 4).map((u) => ({ initials: u.initials, color: u.color }));

  const city = String(me.location || "").split(",")[0].trim();
  const greeting = greetForHour(now.getHours(), me.firstName);
  const dateDesktop = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const dateMobile = `${WEEKDAYS_SHORT[now.getDay()]}, ${MONTHS_SHORT[now.getMonth()]} ${now.getDate()}${city ? ` · ${city}` : ""}`;

  const recentAnnouncements = await Announcement.find({ status: "published" }).sort({ publishedAt: -1 }).limit(2).lean();

  return ok(res, {
    dashboard: {
      user: {
        firstName: me.firstName,
        name: `${me.firstName} ${me.lastName}`,
        initials: initialsOf(`${me.firstName} ${me.lastName}`),
        color: avatarColor(String(me._id)),
        jobTitle: me.jobTitle,
        department: me.department?.name || "",
        location: me.location,
      },
      welcome: {
        greeting,
        subtitle: "Here's what you need to do today.",
        dateDesktop,
        weatherDesktop: city || "",
        dateMobile,
      },
      todaysTasks,
      activeProjects,
      recentActivity: activity,
      statItems,
      upcomingDeadlines,
      teamOnline,
      mobileStats: [
        { value: String(completedMine.length), label: "Completed" },
        { value: `${leaveDays}d`, label: "Leave Balance" },
      ],
      counts: { pendingRequests: myRequests, unreadNotifications: unreadNotifs, runningTimer: runningEntries.length > 0 },
    },
  });
});

function activityFromNotification(n) {
  const icon = n.type === "approval" || n.type === "timesheet" ? "MC" : n.type === "mention" ? "SJ" : "HR";
  return {
    initials: icon,
    color: icon === "SJ" ? "#2E86AB" : icon === "MC" ? "#16A34A" : "#6D28D9",
    text: n.title,
    accent: n.message || undefined,
  };
}

async function teamOf(me, now) {
  const candidates = [];
  if (me.manager) {
    const mgr = await User.findById(me.manager).lean();
    if (mgr) candidates.push(mgr);
  }
  const reports = await User.find({ manager: me.manager, _id: { $ne: me._id }, status: "active" }).sort({ lastLogin: -1 }).limit(6).lean();
  candidates.push(...reports);
  if (candidates.length < 4) {
    const more = await User.find({ _id: { $nin: [me._id, ...candidates.map((c) => c._id)] }, status: "active" }).sort({ lastLogin: -1 }).limit(6).lean();
    candidates.push(...more);
  }
  return candidates.map((u) => ({ initials: initialsOf(`${u.firstName} ${u.lastName}`), color: avatarColor(String(u._id)) }));
}

function greetForHour(hour, firstName) {
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function notFound() {
  const e = new Error("User not found");
  e.statusCode = 404;
  return e;
}
