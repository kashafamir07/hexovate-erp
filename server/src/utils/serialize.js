import {
  avatarColor,
  durLabel,
  initialsOf,
  isSameDay,
  monthDay,
  monthDayRange,
  relTime,
  startOfDay,
  uiTime,
} from "./ui.js";

const uid = (doc) => (doc && doc._id ? String(doc._id) : null);
const refName = (doc, fallback = "") => {
  if (!doc) return fallback;
  if (typeof doc === "object" && (doc.firstName || doc.name)) {
    if (doc.firstName) return `${doc.firstName} ${doc.lastName || ""}`.trim();
    return doc.name;
  }
  return fallback;
};

/* ---------------- people ---------------- */

export function personFromUser(u) {
  const name = refName(u, "");
  return {
    initials: initialsOf(name),
    name,
    role: u.jobTitle || "",
    color: avatarColor(String(u._id || name)),
  };
}

export function userPublic(u) {
  const deptName = u.department && typeof u.department === "object" ? u.department.name : u.departmentName || "";
  const name = refName(u, "");
  return {
    id: uid(u),
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    name,
    email: u.email || "",
    phone: u.phone || "",
    avatar: u.avatar || "",
    location: u.location || "",
    skills: u.skills || [],
    emergencyContact: u.emergencyContact || { name: "", phone: "" },
    role: u.role || "employee",
    jobTitle: u.jobTitle || "",
    employeeId: u.employeeId || "",
    departmentId: uid(u.department),
    departmentName: deptName,
    manager: u.manager && typeof u.manager === "object" ? { id: uid(u.manager), name: refName(u.manager) } : u.managerId ? { id: u.managerId, name: u.managerName || "" } : null,
    managerId: u.managerId || uid(u.manager) || null,
    managerName: u.managerName || refName(u.manager),
    status: u.status || "active",
    joinedAt: u.joinedAt || null,
    lastLogin: u.lastLogin || null,
    notificationPrefs: u.notificationPrefs || { taskAssignments: true, approvalUpdates: true, weeklyDigest: true },
    initials: initialsOf(name),
    color: avatarColor(String(u._id || name)),
  };
}

/** Profile summary used by workspace/account pages. */
export function profileSummary(u) {
  const p = userPublic(u);
  return {
    ...p,
    sub: [p.jobTitle, p.departmentName ? `${p.departmentName} Department` : ""].filter(Boolean).join(" · "),
  };
}

/* ---------------- tasks ---------------- */

export const statusLabel = { todo: "To Do", in_progress: "In Progress", review: "In Review", completed: "Done" };
export const statusFromLabel = Object.fromEntries(Object.entries(statusLabel).map(([k, v]) => [v, k]));
export const priorityLabel = { low: "Low", medium: "Medium", high: "High" };
export const priorityFromLabel = Object.fromEntries(Object.entries(priorityLabel).map(([k, v]) => [v, k]));

export function taskDueLabel(dueDate, now = new Date()) {
  if (!dueDate) return "later";
  const today = startOfDay(now);
  const due = startOfDay(dueDate);
  if (isSameDay(due, today)) return "today";
  if (due < today) return "overdue";
  return "later";
}

export function taskToRow(t, now = new Date()) {
  const proj = t.project && typeof t.project === "object" ? t.project : null;
  return {
    id: uid(t),
    title: t.title || "",
    project: proj ? proj.name : t.projectName || "—",
    projectId: proj ? uid(proj) : t.projectId || null,
    priority: priorityLabel[t.priority] || "Medium",
    due: t.dueDate ? monthDay(t.dueDate) : "—",
    dueLabel: taskDueLabel(t.dueDate, now),
    status: statusLabel[t.status] || "To Do",
    done: t.status === "completed",
  };
}

/** Kanban card shape (project board). */
export function taskToBoardCard(t) {
  const assignee = t.assignedTo && typeof t.assignedTo === "object" ? t.assignedTo : null;
  const name = refName(assignee, "");
  const initials = initialsOf(name);
  return {
    id: uid(t),
    title: t.title || "",
    tag: (t.labels && t.labels[0]) || "Task",
    due: t.dueDate ? `Due ${monthDay(t.dueDate)}` : "No due date",
    initials: initials === "?" ? "—" : initials,
    color: assignee ? avatarColor(String(assignee._id || name)) : "#1F3C88",
    accent: accentFor(t.priority),
    status: t.status,
  };
}

function accentFor(priority) {
  if (priority === "high") return "#DC2626";
  if (priority === "medium") return "#B45309";
  return "#16A34A";
}

/* ---------------- projects ---------------- */

export const projectStatusLabel = { active: "Active", on_hold: "On Hold", completed: "Completed" };

export function projectToCard(p) {
  const members = Array.isArray(p.members) ? p.members : [];
  return {
    id: uid(p),
    name: p.name || "",
    description: p.description || "",
    status: projectStatusLabel[p.status] || "Active",
    progress: p.progress ?? 0,
    due: p.dueDate ? monthDay(p.dueDate) : "—",
    dateRange: monthDayRange(p.startDate, p.dueDate),
    members: members.slice(0, 2).map((m) => (typeof m === "object" ? personFromUser(m) : personFromUser({ _id: m }))),
    memberTotal: members.length,
  };
}

export function projectToDetail(p) {
  const members = Array.isArray(p.members) ? p.members : [];
  return {
    id: uid(p),
    name: p.name || "",
    description: p.description || "",
    status: projectStatusLabel[p.status] || "Active",
    priority: p.priority || "medium",
    progress: p.progress ?? 0,
    startDate: p.startDate || null,
    dueDate: p.dueDate || null,
    due: p.dueDate ? monthDay(p.dueDate) : "—",
    dateRange: monthDayRange(p.startDate, p.dueDate),
    members: members.map((m) => (typeof m === "object" ? personFromUser(m) : personFromUser({ _id: m }))),
    memberTotal: members.length,
    owner: p.owner ? refName(p.owner) : "",
    budget: { spent: p.spent ?? 0, total: p.budget ?? 0 },
  };
}

/* ---------------- time ---------------- */

export function timeEntryToRow(e) {
  const proj = e.project && typeof e.project === "object" ? e.project : null;
  const task = e.task && typeof e.task === "object" ? e.task : null;
  const projectName = e.projectName || (proj ? proj.name : "") || "Internal";
  const taskName = e.taskName || (task ? task.title : "") || e.description || "Time entry";
  return {
    id: uid(e),
    date: monthDay(e.date || e.startTime || e.createdAt),
    task: taskName,
    project: projectName,
    duration: durLabel(e.duration),
    minutes: e.duration || 0,
    billable: e.billable ? "Billable" : "Non-billable",
    manual: e.manual || false,
  };
}

/** Currently-running timer view model (frontend Time Tracker hero). */
export function currentTimerView(e) {
  if (!e) return null;
  const start = e.startTime ? new Date(e.startTime) : new Date();
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  const proj = e.project && typeof e.project === "object" ? e.project : null;
  const task = e.task && typeof e.task === "object" ? e.task : null;
  return {
    id: uid(e),
    task: e.taskName || (task ? task.title : "") || e.description || "Working",
    project: e.projectName || (proj ? proj.name : "") || "Internal",
    startElapsed: elapsedSeconds,
  };
}

/* ---------------- requests ---------------- */

export const requestKindLabel = { leave: "Leave", permission: "Leave", expense: "Expense", equipment: "Purchase Order", other: "Purchase Order" };
export const requestStatusLabel = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };

export function requestToRow(r) {
  const reviewer = r.reviewer && typeof r.reviewer === "object" ? refName(r.reviewer) : r.reviewerName || "—";
  let dates = "—";
  if (r.startDate || r.endDate) dates = monthDayRange(r.startDate, r.endDate);
  else if (r.createdAt) dates = monthDay(r.createdAt);
  return {
    id: uid(r),
    kind: requestKindLabel[r.type] || "Leave",
    type: r.type,
    description: r.title || "",
    dates,
    submitted: r.createdAt ? monthDay(r.createdAt) : "—",
    approver: reviewer,
    status: requestStatusLabel[r.status] || "Pending",
    notes: r.description || undefined,
    amount: r.amount ?? null,
  };
}

/* ---------------- announcements ---------------- */

export function announcementToRow(a) {
  const authorName = refName(a.author, "People Ops");
  const initials = initialsOf(authorName);
  return {
    id: uid(a),
    author: authorName,
    authorInitials: initials === "?" ? "HR" : initials,
    meta: "Pinned",
    title: a.title || "",
    body: a.content || "",
    pinned: a.priority === "important" || a.priority === "urgent",
    createdAt: a.publishedAt || a.createdAt,
  };
}

/** meta is filled by the caller ('Pinned' vs relative time) */
export function announcementRow(a, now = new Date()) {
  const row = announcementToRow(a);
  row.meta = row.pinned ? "Pinned" : relTime(row.createdAt, now);
  return row;
}

/* ---------------- notifications ---------------- */

export const notificationIcon = {
  task: "task",
  approval: "approval",
  mention: "mention",
  announcement: "announcement",
  timesheet: "approval",
  system: "task",
};

export function notificationToItem(n, now = new Date()) {
  return {
    id: uid(n),
    title: n.title || "",
    body: n.message || "",
    time: relTime(n.createdAt, now),
    icon: notificationIcon[n.type] || "task",
    read: Boolean(n.read),
  };
}

/* ---------------- messages ---------------- */

export function chatMessage(m, meId, meName) {
  const sender = m.sender && typeof m.sender === "object" ? m.sender : null;
  const senderName = refName(sender, meName);
  return {
    initials: initialsOf(senderName),
    name: senderName,
    time: uiTime(m.createdAt),
    text: m.body || "",
    mine: sender ? String(sender._id) === String(meId) : true,
  };
}

export { avatarColor, durLabel, initialsOf, isSameDay, monthDay, monthDayRange, relTime, startOfDay, uiTime };
