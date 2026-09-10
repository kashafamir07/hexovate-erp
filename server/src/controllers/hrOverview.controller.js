import { Attendance } from "../models/Attendance.js";
import { Request } from "../models/Request.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { Department } from "../models/Department.js";
import { Initiative } from "../models/Initiative.js";
import { JobPosting } from "../models/JobPosting.js";
import { RevenueRecord } from "../models/RevenueRecord.js";
import { Announcement } from "../models/Announcement.js";
import { Project } from "../models/Project.js";
import { TimeEntry } from "../models/TimeEntry.js";
import { Timesheet } from "../models/Timesheet.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { ApiError } from "../utils/ApiError.js";
import { scopeOf } from "../utils/leader.js";
import { monthKey, startOfMonth, endOfMonth } from "../utils/leader.js";
import { durLabel, relTime, weekStart } from "../utils/ui.js";
import * as an from "../services/analytics.service.js";

const DAY = 86400000;
const startToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const moneyCompact = (n) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
};

function deltaOf(cur, prev, { invert = false, decimals = 0 } = {}) {
  if (cur == null || prev == null || prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  const dir = pct === 0 ? "flat" : pct > 0 ? "up" : "down";
  const risingIsGood = !invert;
  const good = dir === "flat" ? null : (pct > 0) === risingIsGood;
  return { pct, dir, note: `${dir === "flat" ? "No change" : `${Math.abs(pct)}% ${dir === "up" ? "increase" : "decrease"}`} vs last month`, good };
}

/* ---------------- dashboard ---------------- */

export const hrDashboard = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const ids = scope.userIds;
  const type = scope.type;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonth = endOfMonth(now);

  const org = type === "org";
  const users = org ? await an.orgUsers() : await an.orgUsers().then((all) => all.filter((u) => ids.some((id) => String(id) === String(u._id)) && u.status === "active"));

  const active = users.filter((u) => u.status === "active");
  const people = scope.people.map((u) => ({ ...u, departmentName: "" }));

  // attendance: current month (full + partial), plus today
  const monthRecords = await an.attendanceRecords(ids, monthStart, nextMonth);
  const monthly = an.monthlyAttendance(monthRecords, 8).filter((m) => m.key <= monthKey(now));
  const thisMonthBucket = monthly.find((m) => m.key === monthKey(now)) || { rate: null, present: 0, late: 0, absent: 0 };
  const lastMonthIdx = monthly.length - 2;
  const lastMonthBucket = lastMonthIdx >= 0 ? monthly[lastMonthIdx] : null;
  const attendanceToday = await an.attendanceToday(ids);

  // leaves
  const leaveReqAll = await an.leaveRequests(ids, { from: new Date(now.getTime() - 300 * DAY) });
  const onLeave = await an.onLeaveToday(ids);
  const leaveTrend = an.leaveByMonth(leaveReqAll, 8).filter((p) => p.value > 0 || leaveReqAll.some((r) => monthKey(r.startDate) === p.key));
  const pendingLeaves = leaveReqAll.filter((r) => r.status === "pending");

  // pending approvals (all kinds)
  const pendingRequests = await Request.find({ requester: { $in: ids }, status: "pending" })
    .populate("requester", "firstName lastName jobTitle department")
    .sort({ createdAt: -1 })
    .lean();

  // performance
  const perf = await an.perfSnapshot(ids);
  const perfDist = Object.entries(perf.dist).map(([label, value]) => ({ label, value }));

  // tasks
  const tsk = await an.taskSnapshot(ids);
  const months8 = [...new Set([...tsk.doneByMonth.keys()])].sort();
  void months8;

  // payroll / headcount / positions / departments (org level)
  let payroll = [];
  let payrollThis = null;
  let payrollPrev = null;
  let headcountSeries = [];
  let hiringSeries = [];
  let deptDist = [];
  let deptRows = [];
  let positions = [];
  let departments = [];
  if (org) {
    payroll = await an.payrollByMonth(6);
    payrollThis = payroll[payroll.length - 1]?.net ?? null;
    payrollPrev = payroll[payroll.length - 2]?.net ?? null;
    headcountSeries = an.orgHeadcountSeries(users, 8);
    hiringSeries = an.movementByMonth(users, 8).map((m) => ({ label: m.label, value: m.hires }));
    departments = await Department.find({}).select("name members status manager").lean();
    deptDist = departments.map((d) => ({
      label: d.name,
      value: users.filter((u) => u.status === "active" && String(u.department || "") === String(d._id)).length,
    }));
    positions = await an.openPositions();
  }

  // department performance table (org only)
  let deptPerf = [];
  if (org) {
    const perfByUser = new Map([...perf.byUser.entries()].map(([uid, r]) => [uid, r.score || 0]));
    const openByDept = new Map();
    for (const p of positions) {
      const did = p.department && typeof p.department === "object" ? p.department : null;
      const key = did ? String(did._id || did) : "";
      openByDept.set(key, (openByDept.get(key) || 0) + (p.openings || 1));
    }
    for (const d of departments) {
      const members = users.filter((u) => String(u.department || "") === String(d._id) && u.status === "active");
      const scores = members.map((m) => perfByUser.get(String(m._id))).filter((s) => s != null);
      const rate = thisMonthBucket.rate;
      const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
      const status = rate != null && rate < 80 ? "Review" : rate != null && rate < 88 ? "Attention" : "On track";
      deptPerf.push({
        dept: d.name,
        headcount: members.length,
        attendance: rate,
        score: avg,
        openPositions: openByDept.get(String(d._id)) || 0,
        status,
      });
    }
    deptPerf.sort((a, b) => b.headcount - a.headcount);
  }

  const alerts = org
    ? await buildOrgAlerts({ users, departments, monthly, perf, leaveReqAll, onLeave, positions, pendingRequests })
    : await buildTeamAlerts({ scope, attendanceToday, perf, pendingRequests, pendingLeaves, leaveReqAll });

  // Manager (team lead) dashboard sections — direct-reports only
  let mgr = null;
  let managerSections = null;
  if (scope.type === "team") {
    const m = await buildManagerData({ scope, users, attendanceToday, onLeave, tsk, pendingRequests, now });
    mgr = m.kpis;
    managerSections = m.sections;
  }

  // KPI cards per role
  const kpis = buildKpis({
    type,
    org,
    users,
    active,
    scope,
    monthStart,
    now,
    thisMonthBucket,
    lastMonthBucket,
    attendanceToday,
    onLeave,
    perf,
    payrollThis,
    payrollPrev,
    pendingRequests,
    pendingLeaves,
    positions,
    tsk,
    mgr,
  });

  // team / dept dashboard people rows
  let teamToday = [];
  if (!org) {
    const onLeaveIds = new Set(onLeave.map((o) => o.id));
    const statusLabel = { present: "Present", late: "Late", absent: "Absent", leave: "On leave", half_day: "Half day" };
    teamToday = people.map((p) => {
      const rec = attendanceToday.byUser.get(String(p._id));
      const uid = String(p._id);
      const score = perf.byUser.get(uid)?.score ?? null;
      const open = tsk.openByUser.get(uid) || 0;
      const first = tsk.firstOpen.get(uid);
      return {
        id: String(p._id),
        name: `${p.firstName} ${p.lastName || ""}`.trim(),
        initials: an.personRow(p).initials,
        color: an.personRow(p).color,
        jobTitle: p.jobTitle || "",
        status: onLeaveIds.has(String(p._id)) ? "On leave" : statusLabel[rec?.status || "absent"],
        score,
        tasksOpen: open,
        currentTask: first ? first.title : open ? `${open} open tasks` : "No open tasks",
      };
    });
    teamToday.sort((a, b) => (b.status === "On leave") - (a.status === "On leave") || b.score - a.score);
  }

  const approvals = pendingRequests.slice(0, 6).map((r) => ({
    id: String(r._id),
    kind: an.leaveTypeLabel(r.type === "leave" ? "leave" : r.type),
    description: r.title,
    employee: r.requester ? `${r.requester.firstName} ${r.requester.lastName || ""}`.trim() : "",
    initials: r.requester ? an.personRow(r.requester).initials : "?",
    color: r.requester ? an.personRow(r.requester).color : "#6b7280",
    submitted: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
  }));

  const charts = {
    attendance: monthly.map((m) => ({ label: m.label, value: m.rate ?? 0 })),
    leave: leaveTrend.map((p) => ({ label: p.label, value: p.value })),
    performance: perfDist,
  };
  if (org) {
    charts.headcount = headcountSeries.map((p) => ({ label: p.label, value: p.value }));
    charts.hiring = hiringSeries;
    charts.payroll = payroll.map((p) => ({ label: p.label, value: p.net }));
    charts.deptDist = deptDist;
    charts.leave = leaveTrend;
  } else {
    charts.statusToday = [
      { label: "Present", value: attendanceToday.counts.present + attendanceToday.counts.late },
      { label: "Late", value: attendanceToday.counts.late },
      { label: "Absent", value: attendanceToday.counts.absent },
      { label: "On leave", value: onLeave.length },
    ].filter((x) => x.value > 0);
    const doneMonths = new Map();
    for (let i = 0; i < 8; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
      doneMonths.set(monthKey(d), 0);
    }
    for (const [k, v] of tsk.doneByMonth) if (doneMonths.has(k)) doneMonths.set(k, v);
    charts.activity = [...doneMonths.entries()].map(([key, value]) => ({
      label: new Date(`${key}-15T12:00:00`).toLocaleDateString("en-US", { month: "short" }),
      value,
    }));
  }

  // "MD / Executive" strategic board — same figma for CEO and Executive roles.
  const ceoBlock = ["ceo", "executive"].includes(req.user.role)
    ? await buildCeoBlock({ users, now, monthStart, departments: departments || [], monthRecords, perf, pendingRequests })
    : null;

  return ok(res, {
    dashboard: {
      scope: {
        type,
        name: scope.name,
        label: org ? "Company" : scope.label,
        memberCount: ids.length,
        todayRate: todayRateOf(attendanceToday, onLeave),
        todayCounts: { present: attendanceToday.counts.present, late: attendanceToday.counts.late, absent: attendanceToday.counts.absent, onLeave: onLeave.length, total: ids.length },
      },
      kpis,
      charts,
      deptPerf,
      teamToday,
      approvals: { total: pendingRequests.length, items: approvals },
      alerts,
      onLeaveToday: onLeave.slice(0, 8),
      manager: managerSections,
      ceo: ceoBlock,
    },
  });
});

function todayRateOf(att, onLeave) {
  const denom = att.counts.present + att.counts.late + att.counts.absent;
  if (!denom) return null;
  return Math.round(((att.counts.present + att.counts.late) / denom) * 1000) / 10;
}

/* ---------------- manager (team lead) dashboard ---------------- */

const MGR_PRIORITY = { low: "Low", medium: "Medium", high: "High" };

/**
 * Extra sections for the Team-Lead dashboard (Figma "Manager Role" board):
 * KPIs (team size / active / overdue / weekly hours), tasks due today,
 * active projects, a recent-activity feed, pending-request groups,
 * upcoming deadlines, team-online avatars and the attendance summary.
 * Data is strictly limited to the manager's direct reports (scope.userIds).
 */
async function buildManagerData({ scope, users, attendanceToday, onLeave, tsk, pendingRequests, now }) {
  const ids = scope.userIds;
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const monday = weekStart(now);
  const lastMonday = new Date(monday.getTime() - 7 * DAY);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + DAY);

  const personOf = (ref) => {
    if (!ref) return null;
    const id = String(ref._id || ref);
    const u = byId.get(id);
    if (u) return an.personRow(u);
    return ref && typeof ref === "object" && ref.firstName ? an.personRow(ref) : null;
  };
  const taskDueRow = (t) => {
    const who = personOf(t.assignedTo);
    return {
      id: String(t._id),
      title: t.title || "",
      project: t.project && typeof t.project === "object" ? t.project.name : "",
      assignee: who,
      priority: MGR_PRIORITY[t.priority] || "Medium",
      priorityKey: t.priority || "medium",
    };
  };

  const openTasks = tsk.tasks.filter((t) => t.status !== "completed");
  const overdue = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const tasksDueToday = openTasks
    .filter((t) => t.dueDate && new Date(t.dueDate) >= startToday && new Date(t.dueDate) < endToday)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6)
    .map(taskDueRow);
  const upcomingDeadlines = openTasks
    .filter((t) => t.dueDate && new Date(t.dueDate) >= endToday)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6)
    .map((t) => ({
      id: String(t._id),
      title: t.title || "",
      project: t.project && typeof t.project === "object" ? t.project.name : "",
      date: new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));

  const [projects, weekEntries, lastWeekEntries, recentTasks, recentRequests, recentTime, submittedSheets] = await Promise.all([
    Project.find({ status: "active", $or: [{ members: { $in: ids } }, { owner: { $in: ids } }] }).sort({ dueDate: 1 }).lean(),
    TimeEntry.find({ user: { $in: ids }, date: { $gte: monday }, status: "stopped" }).lean(),
    TimeEntry.find({ user: { $in: ids }, date: { $gte: lastMonday, $lt: monday }, status: "stopped" }).lean(),
    Task.find({ assignedTo: { $in: ids } }).populate("assignedTo", "firstName lastName").sort({ createdAt: -1 }).limit(8).lean(),
    Request.find({ requester: { $in: ids } }).populate("requester", "firstName lastName").sort({ createdAt: -1 }).limit(8).lean(),
    TimeEntry.find({ user: { $in: ids } }).populate("user", "firstName lastName").sort({ createdAt: -1 }).limit(8).lean(),
    Timesheet.countDocuments({ user: { $in: ids }, status: "submitted" }),
  ]);

  const activeProjects = projects.slice(0, 5).map((p) => ({
    id: String(p._id),
    name: p.name || "",
    dueDate: p.dueDate || null,
    dueLabel: p.dueDate ? `Due ${new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No due date",
    progress: p.progress ?? 0,
  }));

  const weekMinutes = weekEntries.reduce((s, e) => s + (e.duration || 0), 0);
  const lastWeekMinutes = lastWeekEntries.reduce((s, e) => s + (e.duration || 0), 0);

  // Recent team activity — task/request/time feed, newest first.
  const feed = [];
  for (const t of recentTasks) {
    const who = personOf(t.assignedTo);
    if (!who) continue;
    const done = t.status === "completed" && t.completedAt && new Date(t.completedAt) >= new Date(now.getTime() - DAY);
    feed.push({
      ts: done ? t.completedAt : t.createdAt,
      who,
      text: `${who.name} ${done ? "completed task" : "created task"} “${t.title || ""}”`,
    });
  }
  for (const r of recentRequests) {
    const who = r.requester && typeof r.requester === "object" ? an.personRow(r.requester) : null;
    if (!who) continue;
    feed.push({
      ts: r.createdAt,
      who,
      text: `${who.name} submitted ${r.type === "leave" ? "a leave request" : `a ${an.leaveTypeLabel(r.type).toLowerCase()} request`}`,
    });
  }
  for (const e of recentTime) {
    const who = e.user && typeof e.user === "object" ? an.personRow(e.user) : null;
    if (!who) continue;
    feed.push({
      ts: e.createdAt || e.date,
      who,
      text: `${who.name} logged ${durLabel(e.duration || 0)} on ${e.projectName || "work"}`,
    });
  }
  const recentActivity = feed
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 6)
    .map((f) => ({
      id: `${f.who.initials}-${new Date(f.ts).getTime()}`,
      initials: f.who.initials,
      color: f.who.color,
      text: f.text,
      time: relTime(f.ts, now),
    }));

  const pendingLeaves = pendingRequests.filter((r) => r.type === "leave").length;
  const pendingGroups = [
    { id: "leaves", label: "Leave requests", count: pendingLeaves, to: "/manager/leaves" },
    { id: "approvals", label: "Approvals", count: pendingRequests.length - pendingLeaves, to: "/manager/approvals" },
  ];
  if (submittedSheets > 0) pendingGroups.push({ id: "timesheets", label: "Timesheet corrections", count: submittedSheets, to: "/manager/reports" });

  const online = scope.people.filter((p) => {
    const rec = attendanceToday.byUser.get(String(p._id));
    return rec && (rec.status === "present" || rec.status === "late");
  });
  const teamOnline = { count: online.length, total: ids.length, people: online.slice(0, 5).map((p) => an.personRow(p)) };

  const attendanceSummary = [
    { label: "Present", value: attendanceToday.counts.present + attendanceToday.counts.late, note: attendanceToday.counts.absent ? `${attendanceToday.counts.absent} absent` : "" },
    { label: attendanceToday.counts.half > 0 ? "Remote" : "Absent", value: attendanceToday.counts.half > 0 ? attendanceToday.counts.half : attendanceToday.counts.absent, note: "" },
    { label: "On Leave", value: onLeave.length, note: "" },
  ].filter((r) => r.value > 0);

  const tasksThisWeek = tsk.tasks.filter((t) => t.createdAt && t.createdAt >= monday).length;
  const tasksLastWeek = tsk.tasks.filter((t) => t.createdAt && t.createdAt >= lastMonday && t.createdAt < monday).length;
  const overdueClearedThisWeek = tsk.tasks.filter(
    (t) => t.status === "completed" && t.completedAt && t.completedAt >= monday && t.dueDate && new Date(t.dueDate) < new Date(t.completedAt)
  ).length;
  const hoursPct = lastWeekMinutes > 0 ? Math.round(((weekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100) / 10 : null;

  return {
    kpis: {
      teamSize: scope.userIds.length,
      activeTasks: openTasks.length,
      overdueTasks: overdue.length,
      weekHours: Math.round((weekMinutes / 60) * 10) / 10,
      tasksThisWeek,
      tasksLastWeek,
      overdueClearedThisWeek,
      hoursPct,
    },
    sections: {
      tasksDueToday,
      activeProjects,
      recentActivity,
      pendingGroups,
      upcomingDeadlines,
      teamOnline,
      attendanceSummary,
    },
  };
}

function buildKpis(opts) {
  const { type, org, users, active, scope, monthStart, now, thisMonthBucket, lastMonthBucket, attendanceToday, onLeave, perf, payrollThis, payrollPrev, pendingRequests, pendingLeaves, positions, tsk, mgr } = opts;
  const activeCount = active.length;

  const hires = (from, to) => users.filter((u) => u.joinedAt && new Date(u.joinedAt) >= from && new Date(u.joinedAt) <= to).length;
  const leavers = (from, to) => users.filter((u) => u.leftAt && new Date(u.leftAt) >= from && new Date(u.leftAt) <= to).length;
  const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

  const list = [];

  if (org) {
    const hiresThis = hires(monthStart, now);
    const hiresLast = hires(lastMonthStart, monthStart);
    const leftThis = leavers(monthStart, now);
    const totalAll = users.length;
    const deptCount = new Set(users.filter((u) => u.department && u.status === "active").map((u) => String(u.department))).size;
    const turnoverRate = activeCount ? Math.round((leftThis / (activeCount + leftThis)) * 1000) / 10 : 0;
    const todayDenom = attendanceToday.counts.present + attendanceToday.counts.late + attendanceToday.counts.absent;
    const todayRate = todayDenom ? Math.round(((attendanceToday.counts.present + attendanceToday.counts.late) / todayDenom) * 1000) / 10 : null;

    list.push(
      kpi("totalEmployees", String(totalAll), "Total Employees", deltaOf(hiresThis, hiresLast, { invert: false }) && { ...deltaOf(hiresThis, hiresLast), note: `${hiresThis} new this month` }),
      kpi("active", String(activeCount), "Active Employees", null, `${Math.round((activeCount / Math.max(1, totalAll)) * 100)}% of headcount`),
      kpi("newHires", String(hiresThis), "New Hires", deltaOf(hiresThis, hiresLast, { invert: false }), "joined this month"),
      kpi("onLeave", String(onLeave.length), "Employees on Leave", null, "approved leave today"),
      kpi("attendanceRate", todayRate == null ? "—" : `${todayRate}%`, "Attendance Rate", deltaOf(thisMonthBucket.rate, lastMonthBucket?.rate, { invert: false }), "today"),
      kpi("avgPerformance", perf.avg == null ? "—" : String(perf.avg), "Average Performance", perf.currentPeriodAvg != null && perf.prevPeriodAvg != null ? { ...deltaOf(perf.currentPeriodAvg, perf.prevPeriodAvg, { invert: false }), note: "vs previous review period" } : null, "latest review period"),
      kpi("payroll", payrollThis == null ? "—" : moneyCompact(payrollThis), "Payroll — This Month", deltaOf(payrollThis, payrollPrev, { invert: false }), "net pay"),
      kpi("departments", String(deptCount || 0), "Departments", null, `${activeCount ? Math.round(activeCount / Math.max(1, deptCount || 1)) : 0} avg per department`),
      kpi("turnover", `${turnoverRate}%`, "Employee Turnover", null, `${leftThis} left this month`, "monthly rate"),
      kpi("openPositions", String(positions?.reduce((s, p) => s + (p.openings || 1), 0) || 0), "Open Positions", null, `${positions?.filter((p) => p.status === "open").length || 0} active postings`),
      kpi("pendingApprovals", String(pendingRequests.length), "Pending Approvals", null, `${pendingLeaves.length} are leave requests`)
    );
  } else {
    const isTeam = type === "team";
    const presentNow = attendanceToday.counts.present;
    const denom = attendanceToday.counts.present + attendanceToday.counts.late + attendanceToday.counts.absent;
    const todayRate = denom ? Math.round(((attendanceToday.counts.present + attendanceToday.counts.late) / denom) * 1000) / 10 : null;
    const thisRate = thisMonthBucket?.rate ?? null;
    const prevRate = lastMonthBucket?.rate ?? null;
    const openTasks = [...tsk.openByUser.values()].reduce((a, b) => a + b, 0);

    const base = [
      kpi(isTeam ? "teamSize" : "deptEmployees", String(activeCount), isTeam ? "My Team Size" : "Department Employees", null, isTeam ? "direct reports" : `in ${scope.name}`),
      kpi("present", String(presentNow + attendanceToday.counts.late), "Present Today", null, `${attendanceToday.counts.late} late`),
      kpi("absent", String(attendanceToday.counts.absent), "Absent Today", null, "no attendance mark"),
      kpi("onLeave", String(onLeave.length), "Employees on Leave", null, "approved leave today"),
      kpi("attendanceRate", todayRate == null ? "—" : `${todayRate}%`, "Attendance Rate", deltaOf(thisRate, prevRate, { invert: false }), `${isTeam ? "team" : "department"} today`),
      kpi("pendingApprovals", String(pendingRequests.length), isTeam ? "Pending Leave Requests" : "Pending Leave Requests", null, `${pendingLeaves.length} leave · ${pendingRequests.length - pendingLeaves.length} other`),
    ];
    if (isTeam && mgr) {
      // Figma "Manager Role" dashboard KPIs
      list.push(
        kpi("teamSize", String(mgr.teamSize), "Team Members", null, "direct reports"),
        kpi(
          "activeTasks",
          String(mgr.activeTasks),
          "Active Tasks",
          null,
          `${mgr.tasksThisWeek} opened this week`,
          "",
          // Figma: green "▲ N this week" chip = tasks opened since Monday.
          mgr.tasksThisWeek > 0 ? { dir: "up", label: `${mgr.tasksThisWeek} this week`, good: true } : null
        ),
        kpi(
          "overdueTasks",
          String(mgr.overdueTasks),
          "Overdue Tasks",
          null,
          `${mgr.overdueClearedThisWeek} cleared since Mon`,
          "",
          mgr.overdueClearedThisWeek > 0 ? { dir: "down", label: `${mgr.overdueClearedThisWeek} since Mon`, good: true } : null
        ),
        kpi(
          "teamHours",
          String(mgr.weekHours),
          "Team Hours (wk)",
          null,
          "logged this week",
          "",
          mgr.hoursPct != null ? { dir: mgr.hoursPct >= 0 ? "up" : "down", label: `${Math.abs(mgr.hoursPct)}% vs last wk`, good: mgr.hoursPct >= 0 } : null
        )
      );
    } else {
      if (isTeam) {
        base.push(kpi("pendingTasks", String(openTasks), "Pending Tasks", null, "open across the team"));
      } else {
        base.push(kpi("pendingApprovals2", String(pendingRequests.length), "Pending Approvals", null, "requests to review"));
      }
      base.push(kpi("teamPerformance", perf.avg == null ? "—" : String(perf.avg), "Team Performance", perf.currentPeriodAvg != null && perf.prevPeriodAvg != null ? deltaOf(perf.currentPeriodAvg, perf.prevPeriodAvg, { invert: false }) : null, "average review score"));
      list.push(...base);
    }
  }
  return list;
}

function kpi(id, value, label, delta, note, sub, trend) {
  return { id, value, label, delta, note: note || "", sub: sub || "", trend: trend || null };
}

/* ---------------- alerts ---------------- */

async function buildOrgAlerts({ users, departments, monthly, perf, leaveReqAll, onLeave, positions, pendingRequests }) {
  const alerts = [];
  const thisMonth = monthly.find((m) => m.key === monthKey(new Date()));
  const rate = thisMonth?.rate ?? null;
  if (rate != null && rate < 88) {
    alerts.push({
      id: "att", tone: rate < 80 ? "danger" : "warning", title: "Attendance below target", body: `Company attendance is ${rate}% this month (target ≥ 92%).`,
    });
  }
  const active = users.filter((u) => u.status === "active");
  const byDept = new Map();
  for (const u of active) {
    const did = u.department ? String(u.department) : "none";
    if (!byDept.has(did)) byDept.set(did, []);
    byDept.get(did).push(u);
  }
  const deptNames = new Map(departments.map((d) => [String(d._id), d.name]));
  for (const [did, members] of byDept) {
    const name = deptNames.get(did) || "Other";
    const scores = members.map((m) => perf.byUser.get(String(m._id))?.score).filter((s) => s != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    if (avg != null && avg < 70) {
      alerts.push({ id: `perf-${did}`, tone: "warning", title: `${name} — performance concern`, body: `Average latest score is ${Math.round(avg * 10) / 10}. Review cycle may be needed.` });
    }
  }
  const openCount = positions?.reduce((s, p) => s + (p.openings || 1), 0) || 0;
  if (openCount) {
    alerts.push({ id: "open", tone: "info", title: `${openCount} open position${openCount === 1 ? "" : "s"}`, body: "Recruitment pipeline is active — see Recruitment for details." });
  }
  if (onLeave.length > 4) {
    alerts.push({ id: "leave", tone: "info", title: `${onLeave.length} employees on leave today`, body: `${onLeave.map((o) => o.name.split(" ")[0]).slice(0, 3).join(", ")}${onLeave.length > 3 ? "…" : ""} are out on approved leave.` });
  }
  if (pendingRequests.length) {
    alerts.push({ id: "approvals", tone: "warning", title: `${pendingRequests.length} approvals pending`, body: "Requests across the org are waiting on reviewers." });
  }
  const important = await Announcement.find({ status: "published", priority: { $in: ["important", "urgent"] } }).sort({ publishedAt: -1 }).limit(2).lean();
  for (const a of important) {
    alerts.push({ id: `ann-${String(a._id)}`, tone: "info", title: a.title, body: String(a.content || "").slice(0, 140) });
  }
  return alerts.slice(0, 8);
}

async function buildTeamAlerts({ scope, attendanceToday, perf, pendingRequests, pendingLeaves, leaveReqAll }) {
  const alerts = [];
  if (pendingRequests.length) {
    const kinds = {};
    for (const r of pendingRequests) kinds[r.type] = (kinds[r.type] || 0) + 1;
    const detail = Object.entries(kinds).map(([k, v]) => `${v} ${an.leaveTypeLabel(k === "leave" ? "leave" : k).toLowerCase()}`).join(", ");
    alerts.push({ id: "approvals", tone: "warning", title: `${pendingRequests.length} request${pendingRequests.length === 1 ? "" : "s"} awaiting your review`, body: detail || "Pending approvals in your queue." });
  }
  const absentIds = [];
  for (const [uid, rec] of attendanceToday.byUser) {
    if (rec.status === "absent" || rec.status === "leave") absentIds.push(uid);
  }
  if (absentIds.length) {
    const names = absentIds
      .map((id) => scope.people.find((p) => String(p._id) === id))
      .filter(Boolean)
      .map((p) => p.firstName)
      .slice(0, 3);
    alerts.push({ id: "absent", tone: attendanceToday.counts.absent ? "danger" : "info", title: `${attendanceToday.counts.absent} absent today`, body: names.length ? `${names.join(", ")}${absentIds.length > 3 ? "…" : ""} — reach out if support is needed.` : "No absences marked today." });
  }
  const concerns = [...perf.byUser.entries()]
    .map(([uid, r]) => ({ uid, score: r.score || 0, name: scope.people.find((p) => String(p._id) === uid) }))
    .filter((x) => x.score > 0 && x.score < 70 && x.name)
    .slice(0, 3);
  if (concerns.length) {
    alerts.push({ id: "perf", tone: "warning", title: "Performance concerns", body: `${concerns.map((c) => c.name.firstName).join(", ")} scored below 70 in their latest review.` });
  }
  const recentLeaves = leaveReqAll.filter((r) => r.status === "approved" && r.startDate && new Date(r.startDate) >= startOfMonth(new Date()));
  if (recentLeaves.length >= 3) {
    alerts.push({ id: "leave", tone: "info", title: `${recentLeaves.length} approved leave${recentLeaves.length === 1 ? "" : "s"} this month`, body: "Leave usage is healthy — plan coverage for upcoming dates." });
  }
  if (pendingLeaves.length) {
    alerts.push({ id: "leaves", tone: "info", title: `${pendingLeaves.length} leave request${pendingLeaves.length === 1 ? "" : "s"} to review`, body: "Open Leave Requests to approve or reject with a note." });
  }
  return alerts.slice(0, 6);
}

/* ---------------- CEO dashboard (executive board) ---------------- */

/** Company revenue: latest monthly figure + month-over-month growth. */
async function companyRevenue() {
  const rows = await RevenueRecord.find({}).sort({ month: 1 }).lean();
  if (!rows.length) return { annualized: null, growthPct: null, latest: null, prev: null };
  const latest = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const growthPct =
    prev && prev.value
      ? Math.round(((latest.value - prev.value) / prev.value) * 1000) / 10
      : null;
  return { annualized: Math.round(latest.value * 12), growthPct, latest: latest.value, prev: prev ? prev.value : null };
}

/** CEO (Figma "MD / Executive") dashboard block — org-wide strategic view. */
async function buildCeoBlock({ users, now, monthStart, departments, monthRecords, perf, pendingRequests }) {
  const DAY_MS = 86400000;
  const current = users.filter((u) => u.status === "active" && (!u.leftAt || new Date(u.leftAt) > now));
  const hiresThis = users.filter((u) => u.joinedAt && new Date(u.joinedAt) >= monthStart && new Date(u.joinedAt) <= now && (!u.leftAt || new Date(u.leftAt) >= new Date(u.joinedAt))).length;

  const revenue = await companyRevenue();

  const activeProjects = await Project.find({ status: "active" }).select("dueDate").lean();
  const soon = new Date(now.getTime() + 14 * DAY_MS);
  const dueSoon = activeProjects.filter((p) => p.dueDate && new Date(p.dueDate) >= now && new Date(p.dueDate) <= soon).length;

  const urgent = pendingRequests.filter((r) => {
    if (r.createdAt && new Date(r.createdAt) <= new Date(now.getTime() - 7 * DAY_MS)) return true;
    return r.type === "leave" && r.startDate && new Date(r.startDate) <= new Date(now.getTime() + 3 * DAY_MS);
  }).length;

  // Executive Priorities — soonest non-completed initiatives first (Figma order).
  const priorities = (
    await Initiative.find({ status: { $ne: "done" } })
      .sort({ createdAt: 1 })
      .limit(4)
      .lean()
  ).map((p) => ({
    id: String(p._id),
    title: p.title || "",
    area: p.area || "",
    dueLabel: p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    status: p.status,
  }));

  // Company Snapshot — composite health per department (performance + attendance).
  const byDeptId = new Map();
  for (const u of users) if (u.department) byDeptId.set(String(u._id), String(u.department));
  const att = new Map(); // deptId -> {present, late, absent}
  const bump = (did, key) => {
    if (!att.has(did)) att.set(did, { present: 0, late: 0, absent: 0 });
    const b = att.get(did);
    b[key] += 1;
  };
  for (const r of monthRecords) {
    const did = byDeptId.get(String(r.user));
    if (!did) continue;
    if (r.status === "present") bump(did, "present");
    else if (r.status === "late") bump(did, "late");
    else if (r.status === "absent") bump(did, "absent");
  }
  const snapshot = departments
    .map((d) => {
      const members = current.filter((u) => String(u.department || "") === String(d._id));
      if (!members.length) return null;
      const scores = members.map((m) => perf.byUser.get(String(m._id))?.score).filter((s) => s != null);
      const perfAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const b = att.get(String(d._id));
      const denom = b ? b.present + b.late + b.absent : 0;
      const attRate = denom ? ((b.present + b.late) / denom) * 100 : null;
      let pct = null;
      if (perfAvg != null && attRate != null) pct = Math.round(perfAvg * 0.5 + attRate * 0.5);
      else if (perfAvg != null) pct = Math.round(perfAvg);
      else if (attRate != null) pct = Math.round(attRate);
      if (pct == null) return null;
      return { dept: d.name, pct: Math.max(0, Math.min(100, pct)) };
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);

  return {
    revenue: { annualized: revenue.annualized, growthPct: revenue.growthPct },
    headcount: { value: current.length, delta: hiresThis },
    projects: { value: activeProjects.length, dueSoon },
    decisions: { value: pendingRequests.length, urgent },
    priorities,
    snapshot,
  };
}

/** Full strategic priorities list (CEO "View priorities" drawer + reports). */
export const hrPriorities = asyncHandler(async (req, res) => {
  const items = await Initiative.find({}).sort({ createdAt: 1 }).lean();
  const now = new Date();
  return ok(res, {
    priorities: items.map((p) => ({
      id: String(p._id),
      title: p.title || "",
      area: p.area || "",
      description: p.description || "",
      due: p.dueDate ? new Date(p.dueDate).toISOString() : null,
      dueLabel: p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date",
      overdue: !!(p.dueDate && new Date(p.dueDate) < now && p.status !== "done"),
      status: p.status,
    })),
  });
});

/* ---------------- departments ---------------- */

/** Org department rows (executive / HR / admin). */
export const hrDepartments = asyncHandler(async (req, res) => {
  const users = await an.orgUsers();
  const departments = await Department.find({}).select("name description status manager members goals").populate("manager", "firstName lastName jobTitle").lean();
  const monthStart = startOfMonth(new Date());
  const ids = users.filter((u) => u.status === "active").map((u) => u._id);
  const monthRecords = await an.attendanceRecords(ids, monthStart, endOfMonth(new Date()));
  const monthly = an.monthlyAttendance(monthRecords, 1);
  const rateByDept = new Map();
  for (const b of monthly) rateByDept.set(b.key, b.rate);
  const perf = await an.perfSnapshot(ids);
  const positions = await JobPosting.find({ status: "open" }).populate("department", "name").lean();
  const openByDept = new Map();
  for (const p of positions) {
    const did = p.department && typeof p.department === "object" ? p.department._id : null;
    if (did) openByDept.set(String(did), (openByDept.get(String(did)) || 0) + (p.openings || 1));
  }
  const pendingByDept = new Map();
  const pending = await Request.find({ status: "pending", requester: { $in: ids } }).select("requester").lean();
  for (const r of pending) {
    const u = users.find((x) => String(x._id) === String(r.requester));
    if (u && u.department) pendingByDept.set(String(u.department), (pendingByDept.get(String(u.department)) || 0) + 1);
  }
  const rows = departments.map((d) => {
    const members = users.filter((u) => String(u.department || "") === String(d._id) && u.status === "active");
    const scores = members.map((m) => perf.byUser.get(String(m._id))?.score).filter((s) => s != null);
    return {
      id: String(d._id),
      name: d.name,
      description: d.description || "",
      manager: d.manager ? `${d.manager.firstName} ${d.manager.lastName || ""}`.trim() : "—",
      headcount: members.length,
      attendance: rateByDept.get(monthKey(new Date())) ?? null,
      score: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      openPositions: openByDept.get(String(d._id)) || 0,
      pendingApprovals: pendingByDept.get(String(d._id)) || 0,
      status: d.status,
    };
  });
  return ok(res, { departments: rows });
});

/** Department detail + goals + recent activity (HR / admins; a manager sees their own department). */
export const hrMyDepartment = asyncHandler(async (req, res) => {
  const actor = req.user;
  if (!["manager", "hr", "admin", "company_admin", "super_admin", "ceo"].includes(actor.role)) {
    throw new ApiError(403, "Only leaders can view a department profile");
  }
  const deptId = actor.role === "manager" ? actor.department : req.query.department || actor.department;
  const dept = await Department.findById(deptId).populate("manager", "firstName lastName jobTitle email").lean();
  if (!dept) throw new ApiError(404, "Department not found");
  const memberQuery = dept.members && dept.members.length
    ? { _id: { $in: dept.members } }
    : { department: dept._id };
  const members = await User.find({ ...memberQuery, status: "active" })
    .select("firstName lastName jobTitle manager department joinedAt")
    .populate("manager", "firstName lastName")
    .lean();
  const ids = members.map((m) => m._id);
  const today = await an.attendanceToday(ids);
  const onLeave = await an.onLeaveToday(ids);
  const perf = await an.perfSnapshot(ids);
  const openTasks = await Task.find({ assignedTo: { $in: ids }, status: { $ne: "completed" } }).sort({ dueDate: 1 }).lean();
  const activity = [];
  const recentRequests = await Request.find({ requester: { $in: ids } }).populate("requester", "firstName lastName").sort({ createdAt: -1 }).limit(6).lean();
  for (const r of recentRequests) {
    activity.push({
      id: `r-${String(r._id)}`, type: r.type === "leave" ? "leave" : "request",
      text: `${r.requester ? r.requester.firstName : "An employee"} ${r.type === "leave" ? "requested leave" : `submitted a ${an.leaveTypeLabel(r.type)} request`}`,
      meta: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
      status: r.status,
    });
  }
  const recentHires = members.filter((m) => m.joinedAt && new Date(m.joinedAt) >= new Date(Date.now() - 120 * DAY)).sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 3);
  for (const h of recentHires) {
    activity.push({ id: `join-${String(h._id)}`, type: "hire", text: `${h.firstName} ${h.lastName || ""} joined the department`, meta: new Date(h.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  }
  const denom = today.counts.present + today.counts.late + today.counts.absent;
  return ok(res, {
    department: {
      id: String(dept._id),
      name: dept.name,
      description: dept.description || "",
      goals: dept.goals || [],
      head: dept.manager ? { name: `${dept.manager.firstName} ${dept.manager.lastName || ""}`.trim(), jobTitle: dept.manager.jobTitle || "", email: dept.manager.email || "" } : null,
      stats: {
        total: members.length,
        active: members.length,
        attendanceToday: denom ? Math.round(((today.counts.present + today.counts.late) / denom) * 1000) / 10 : null,
        present: today.counts.present,
        late: today.counts.late,
        absent: today.counts.absent,
        onLeave: onLeave.length,
        avgPerformance: perf.avg,
        openTasks: openTasks.length,
      },
      people: members.map((m) => ({
        ...an.personRow(m),
        managerName: m.manager && typeof m.manager === "object" ? `${m.manager.firstName} ${m.manager.lastName || ""}`.trim() : "",
        score: perf.byUser.get(String(m._id))?.score ?? null,
        onLeave: onLeave.some((o) => o.id === String(m._id)),
      })),
      recentActivity: activity.slice(0, 8),
    },
  });
});

/** PATCH department goals/description — HR or admins. */
export const patchMyDepartment = asyncHandler(async (req, res) => {
  const actor = req.user;
  const allowed = ["admin", "hr", "company_admin", "super_admin"].includes(actor.role);
  if (!allowed) throw new ApiError(403, "Only HR or admins can update department details");
  const deptId = req.body.department || actor.department;
  const dept = await Department.findById(deptId);
  if (!dept) throw new ApiError(404, "Department not found");
  const { goals, description } = req.body;
  if (Array.isArray(goals)) dept.goals = goals.filter((g) => typeof g === "string" && g.trim()).map((g) => g.trim()).slice(0, 12);
  if (typeof description === "string") dept.description = description;
  await dept.save();
  return ok(res, { department: { id: String(dept._id), goals: dept.goals, description: dept.description } }, "Department updated");
});

/* ---------------- org home (CEO / Company Admin Figma board) ---------------- */

const ROLE_DISPLAY = { employee: "Employee", manager: "Manager", executive: "Executive", hr: "HR", admin: "Admin", ceo: "CEO", company_admin: "Company Admin", super_admin: "Super Admin" };

function relDayLabel(d, base) {
  if (!d) return "";
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(base).setHours(0, 0, 0, 0)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * GET /hr/org-home — the "CEO"/"Company Admin" Figma dashboard:
 * 4 KPI cards (Total Employees / Active Departments / Active Projects / Pending
 * Approvals), 7-day company-activity bar chart, departments overview,
 * pending-approvals table and upcoming deadlines.
 */
export const hrOrgHome = asyncHandler(async (req, res) => {
  const actor = req.user;
  const users = await an.orgUsers();
  const active = users.filter((u) => u.status === "active");
  const ids = active.map((u) => u._id);

  const now = new Date();
  const [departments, projects, pending, positions, timeEntries] = await Promise.all([
    Department.find({ status: "active" }).select("name members").lean(),
    Project.find().select("name status dueDate progress priority").lean(),
    Request.find({ status: "pending" }).populate("requester", "firstName lastName jobTitle department").sort({ createdAt: -1 }).lean(),
    an.openPositions(),
    TimeEntry.find({ user: { $in: ids }, date: { $gte: new Date(now.getTime() - 13 * DAY) } }).select("date duration").lean(),
  ]);

  // KPI 1 — total employees + new hires this month
  const monthStart = startOfMonth(now);
  const newHires = active.filter((u) => u.joinedAt && new Date(u.joinedAt) >= monthStart).length;

  // KPI 4 — pending approvals
  const pendingLeaves = pending.filter((r) => r.type === "leave").length;

  // 7-day activity (Mon..Sun buckets like the Figma chart)
  const monday = weekStart(now);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activity = days.map((label) => ({ label, value: 0 }));
  for (const t of timeEntries) {
    if (!t.date) continue;
    const d = new Date(t.date);
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((d - new Date(monday).setHours(0, 0, 0, 0)) / DAY);
    if (idx >= 0 && idx < 7) activity[idx].value += Math.round((t.duration || 0) / 60);
  }

  // departments overview rows
  const deptRows = departments
    .map((d) => ({
      name: d.name,
      people: active.filter((u) => String(u.department || "") === String(d._id)).length,
    }))
    .sort((a, b) => b.people - a.people);

  // approvals table (top 4)
  const approvalItems = pending.slice(0, 4).map((r) => {
    const p = r.requester ? an.personRow(r.requester) : null;
    const typeKey = r.type === "leave" ? "leave" : r.type;
    return {
      id: String(r._id),
      kind: an.leaveTypeLabel(typeKey),
      summary: r.title,
      status: "Pending",
      employee: p ? p.name : "",
      initials: p ? p.initials : "?",
      color: p ? p.color : "#6b7280",
      submitted: r.createdAt ? relDayLabel(r.createdAt, now) : "",
    };
  });

  // upcoming deadlines (projects + open positions + task deadlines)
  const deadlines = projects
    .filter((p) => p.dueDate && new Date(p.dueDate) >= now && p.status === "active")
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4)
    .map((p) => ({ id: String(p._id), title: p.name, due: relDayLabel(p.dueDate, now), dueTs: p.dueDate }));

  const kpis = [
    { id: "employees", label: "Total Employees", value: String(active.length), delta: newHires ? { text: `+${newHires} this month`, tone: "up" } : null },
    { id: "departments", label: "Active Departments", value: String(departments.length), delta: null },
    { id: "projects", label: "Active Projects", value: String(projects.filter((p) => p.status === "active").length), delta: deadlines.length ? { text: `${deadlines.length} due this week`, tone: "warn" } : null },
    { id: "approvals", label: "Pending Approvals", value: String(pending.length), delta: pending.length ? { text: "Needs review", tone: "down" } : null },
  ];

  return ok(res, {
    home: {
      greeting: `Good ${now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, ${actor.firstName}`,
      dateLine: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      intro: "Here is the company-wide snapshot for today.",
      kpis,
      activity,
      departments: deptRows,
      approvals: { total: pending.length, leaves: pendingLeaves, items: approvalItems },
      deadlines,
      openPositions: positions.length,
    },
  });
});
