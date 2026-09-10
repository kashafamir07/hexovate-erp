import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { app, seedBase, seedWork, startDb, stopDb } from "./helpers.js";
import { Attendance } from "../src/models/Attendance.js";
import { Request } from "../src/models/Request.js";
import { PerformanceReview } from "../src/models/PerformanceReview.js";
import { User } from "../src/models/User.js";
import { Initiative } from "../src/models/Initiative.js";
import { RevenueRecord } from "../src/models/RevenueRecord.js";
import { addDays } from "../src/utils/ui.js";

describe("hr (leader) endpoints — role scoping", () => {
  let base;
  let exec;
  let nina; // manager heading Engineering
  let dhMkt; // manager heading Marketing
  let maya;

  const dayStart = (offset = 0) => {
    const d = addDays(new Date(), offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  before(async () => {
    await startDb();
    base = await seedBase();
    await seedWork(base);
    exec = await base.mk("Sofia", "Reyes", "sofia@test.com", "executive", "COO", base.depts.leadership._id, base.users.priya._id);
    nina = await base.mk("Nina", "Patel", "nina@test.com", "manager", "Head of Design", base.depts.engineering._id, base.users.priya._id);
    dhMkt = await base.mk("Dana", "Okafor", "dana@test.com", "manager", "Head of Marketing", base.depts.marketing._id, base.users.priya._id);
    maya = await base.mk("Maya", "Owens", "maya@test.com", "employee", "Content Lead", base.depts.marketing._id, base.users.alex._id);

    // today's attendance for Engineering team
    await Attendance.insertMany([
      { user: base.users.jordan._id, date: dayStart(0), status: "present", clockIn: new Date(), hours: 8 },
      { user: base.users.david._id, date: dayStart(0), status: "late", clockIn: new Date(), hours: 7.2 },
      { user: maya._id, date: dayStart(0), status: "absent" },
    ]);
  });
  after(async () => {
    await stopDb();
  });

  describe("gate keeping", () => {
    it("employees cannot reach leader dashboards", async () => {
      const res = await request(app).get("/api/hr/dashboard").set(base.auth(base.users.jordan));
      assert.equal(res.status, 403);
      const payroll = await request(app).get("/api/hr/payroll").set(base.auth(base.users.jordan));
      assert.equal(payroll.status, 403);
    });

    it("unauthenticated requests are rejected", async () => {
      const res = await request(app).get("/api/hr/dashboard");
      assert.equal(res.status, 401);
    });
  });

  describe("executive (org scope)", () => {
    it("dashboard returns org KPIs + charts", async () => {
      const res = await request(app).get("/api/hr/dashboard").set(base.auth(exec));
      assert.equal(res.status, 200);
      const d = res.body.data.dashboard;
      assert.equal(d.scope.type, "org");
      assert.ok(d.kpis.some((k) => k.id === "totalEmployees"));
      assert.ok(d.kpis.some((k) => k.id === "attendanceRate"));
      assert.ok(d.charts.headcount && d.charts.headcount.length >= 4);
      assert.ok(d.charts.deptDist.length >= 4);
      assert.ok(Array.isArray(d.deptPerf));
      assert.ok(Array.isArray(d.alerts));
    });

    it("can list departments and run org reports", async () => {
      const depts = await request(app).get("/api/hr/departments").set(base.auth(exec));
      assert.equal(depts.status, 200);
      assert.ok(depts.body.data.departments.length >= 4);
      const headcount = await request(app).get("/api/hr/reports?type=headcount").set(base.auth(exec));
      assert.equal(headcount.status, 200);
      assert.ok(headcount.body.data.report.columns.includes("Month"));
      const payroll = await request(app).get("/api/hr/payroll").set(base.auth(exec));
      assert.equal(payroll.status, 200);
      assert.ok(payroll.body.data.months.length >= 5);
    });

    it("recruitment overview returns positions", async () => {
      const res = await request(app).get("/api/hr/recruitment").set(base.auth(exec));
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.items));
    });
  });

  describe("department manager scope", () => {
    it("dashboard + people are limited to direct reports", async () => {
      const dash = await request(app).get("/api/hr/dashboard").set(base.auth(nina));
      assert.equal(dash.status, 200);
      assert.equal(dash.body.data.dashboard.scope.type, "team");
      const people = await request(app).get("/api/hr/people").set(base.auth(nina));
      assert.equal(people.status, 200);
      assert.ok(Array.isArray(people.body.data.items));
    });

    it("manager cannot see an employee profile outside their team", async () => {
      const res = await request(app).get(`/api/hr/people/${maya._id}`).set(base.auth(nina));
      assert.equal(res.status, 403);
    });

    it("payroll and org reports are denied for managers", async () => {
      const payroll = await request(app).get("/api/hr/payroll").set(base.auth(nina));
      assert.equal(payroll.status, 403);
      const headcount = await request(app).get("/api/hr/reports?type=headcount").set(base.auth(nina));
      assert.equal(headcount.status, 403);
    });

    it("attendance + trend endpoints are scoped but reachable", async () => {
      const today = await request(app).get("/api/hr/attendance/today").set(base.auth(nina));
      assert.equal(today.status, 200);
      const trend = await request(app).get("/api/hr/attendance/trend?weeks=6").set(base.auth(nina));
      assert.equal(trend.status, 200);
      assert.ok(trend.body.data.points.length >= 4);
    });
  });

  describe("manager scope (direct reports)", () => {
    it("dashboard scope is 'team' and reports are its members", async () => {
      const dash = await request(app).get("/api/hr/dashboard").set(base.auth(base.users.mike));
      assert.equal(dash.status, 200);
      assert.equal(dash.body.data.dashboard.scope.type, "team");
      const team = await request(app).get("/api/hr/people").set(base.auth(base.users.mike));
      const names = team.body.data.items.map((p) => p.name);
      assert.ok(names.includes("Jordan Cole"));
      assert.ok(names.includes("David Kim"));
      assert.ok(!names.includes("Sarah Jenkins"));
    });

    it("manager dashboard returns the team-lead sections from Figma (KPIs, projects, activity, groups, deadlines, online, attendance)", async () => {
      const dash = await request(app).get("/api/hr/dashboard").set(base.auth(base.users.mike));
      assert.equal(dash.status, 200);
      const d = dash.body.data.dashboard;
      // Figma KPI set replaces the generic leader cards for managers
      assert.ok(d.kpis.some((k) => k.id === "teamSize" && k.label === "Team Members"));
      assert.ok(d.kpis.some((k) => k.id === "activeTasks" && k.label === "Active Tasks"));
      assert.ok(d.kpis.some((k) => k.id === "overdueTasks" && k.label === "Overdue Tasks"));
      assert.ok(d.kpis.some((k) => k.id === "teamHours" && k.label === "Team Hours (wk)"));
      assert.ok(d.manager, "manager sections present for team scope");
      assert.ok(Array.isArray(d.manager.tasksDueToday));
      assert.ok(Array.isArray(d.manager.activeProjects) && d.manager.activeProjects.length >= 2);
      assert.ok(Array.isArray(d.manager.recentActivity));
      assert.ok(Array.isArray(d.manager.pendingGroups));
      assert.ok(Array.isArray(d.manager.upcomingDeadlines) && d.manager.upcomingDeadlines.length >= 1);
      assert.ok(d.manager.teamOnline.total >= 2);
      assert.ok(Array.isArray(d.manager.attendanceSummary) && d.manager.attendanceSummary.length >= 1);
    });

    it("manager sections never leak people outside the team", async () => {
      const dash = await request(app).get("/api/hr/dashboard").set(base.auth(base.users.mike));
      const d = dash.body.data.dashboard;
      const visible = [
        ...d.manager.teamOnline.people,
        ...d.manager.tasksDueToday.map((t) => t.assignee).filter(Boolean),
      ];
      const names = visible.map((p) => p.name);
      assert.ok(names.includes("Jordan Cole"));
      assert.ok(names.includes("David Kim"));
      assert.ok(!names.includes("Sarah Jenkins"));
      assert.ok(!names.includes("Sana Khalid"));
      // activity feed references only in-scope people
      for (const a of d.manager.recentActivity) {
        assert.ok(!a.text.includes("Sarah Jenkins"), `activity leaked out of scope: ${a.text}`);
      }
    });

    it("manager is denied payroll and executive recruitment", async () => {
      const payroll = await request(app).get("/api/hr/payroll").set(base.auth(base.users.mike));
      assert.equal(payroll.status, 403);
      const rec = await request(app).get("/api/hr/recruitment").set(base.auth(base.users.mike));
      assert.equal(rec.status, 403);
    });

    it("manager can create team tasks but not assign outside the team", async () => {
      const ok = await request(app)
        .post("/api/hr/team-tasks")
        .set(base.auth(base.users.mike))
        .send({ title: "Refactor query builder", assignedTo: String(base.users.david._id), priority: "high", dueDate: addDays(new Date(), 5) });
      assert.equal(ok.status, 201);
      const forbidden = await request(app)
        .post("/api/hr/team-tasks")
        .set(base.auth(base.users.mike))
        .send({ title: "Sneaky task", assignedTo: String(base.users.sarah._id) });
      assert.equal(forbidden.status, 403);
      const list = await request(app).get("/api/hr/team-tasks").set(base.auth(base.users.mike));
      assert.equal(list.status, 200);
      assert.ok(list.body.data.items.every((t) => ["Jordan Cole", "David Kim"].includes(t.assignee?.name)));
    });

    it("manager calendar returns leaves/tasks in the month", async () => {
      const res = await request(app).get("/api/hr/calendar").set(base.auth(base.users.mike));
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.days));
    });

    it("team-activity feed is scoped to direct reports and typed", async () => {
      const res = await request(app).get("/api/hr/team-activity").set(base.auth(base.users.mike));
      assert.equal(res.status, 200);
      const items = res.body.data.items;
      assert.ok(Array.isArray(items) && items.length >= 1);
      assert.ok(items.every((i) => ["task", "request", "time"].includes(i.type)));
      assert.ok(items.every((i) => i.text && i.time));
      assert.ok(items.every((i) => !i.text.includes("Sarah Jenkins")), "activity leaked out of scope");
      // employees cannot access the monitoring feed
      const denied = await request(app).get("/api/hr/team-activity").set(base.auth(base.users.jordan));
      assert.equal(denied.status, 403);
    });
  });

  describe("approvals & performance write paths", () => {
    it("manager can approve their report's leave; cannot approve a stranger's", async () => {
      const mine = await Request.create({
        requester: base.users.david._id,
        type: "leave",
        title: "Family visit",
        status: "pending",
        reviewer: base.users.mike._id,
        startDate: addDays(new Date(), 5),
        endDate: addDays(new Date(), 6),
      });
      const approveMine = await request(app).post(`/api/requests/${mine._id}/approve`).set(base.auth(base.users.mike)).send({ note: "Enjoy" });
      assert.equal(approveMine.status, 200);
      assert.equal(approveMine.body.data.request.status, "Approved");

      const stranger = await Request.create({
        requester: maya._id,
        type: "leave",
        title: "Trip",
        status: "pending",
        reviewer: base.users.alex._id,
        startDate: addDays(new Date(), 9),
        endDate: addDays(new Date(), 10),
      });
      const denied = await request(app).post(`/api/requests/${stranger._id}/approve`).set(base.auth(base.users.mike));
      assert.equal(denied.status, 403);
    });

    it("reviewer can approve a request assigned to them", async () => {
      const req = await Request.create({
        requester: maya._id,
        type: "leave",
        title: "Staycation",
        status: "pending",
        reviewer: dhMkt._id,
        startDate: addDays(new Date(), 12),
        endDate: addDays(new Date(), 13),
      });
      const ok = await request(app).post(`/api/requests/${req._id}/approve`).set(base.auth(dhMkt)).send({ note: "Approved" });
      assert.equal(ok.status, 200);
    });

    it("executive can view performance but not write reviews", async () => {
      const review = await PerformanceReview.create({
        user: base.users.jordan._id,
        reviewer: base.users.mike._id,
        period: "2026-Q2",
        score: 78,
        rating: "Meets expectations",
        goals: ["Ship pricing page"],
        feedback: "Solid work.",
        status: "completed",
      });
      const list = await request(app).get("/api/hr/performance").set(base.auth(exec));
      assert.equal(list.status, 200);
      const patch = await request(app).patch(`/api/hr/performance/${review._id}`).set(base.auth(exec)).send({ score: 10 });
      assert.equal(patch.status, 403);
      const byManager = await request(app).patch(`/api/hr/performance/${review._id}`).set(base.auth(base.users.mike)).send({ score: 84, feedback: "Raised after calibration." });
      assert.equal(byManager.status, 200);
      assert.equal(byManager.body.data.review.score, 84);
    });

    it("manager can only update reviews of people in scope", async () => {
      const outside = await PerformanceReview.create({
        user: maya._id,
        reviewer: base.users.alex._id,
        period: "2026-Q2",
        score: 90,
        status: "completed",
      });
      const res = await request(app).patch(`/api/hr/performance/${outside._id}`).set(base.auth(base.users.mike)).send({ score: 60 });
      assert.equal(res.status, 403);
    });

    it("executive view of a scoped employee profile works for org members", async () => {
      const res = await request(app).get(`/api/hr/people/${base.users.david._id}`).set(base.auth(exec));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.profile.name.includes("David"));
      assert.ok(res.body.data.metrics.openTasks >= 0);
    });
  });

  describe("ceo / company_admin / super_admin (org-wide tiers)", () => {
    let ceo;
    let cadmin;
    let sadmin;

    before(async () => {
      ceo = await base.mk("Omar", "Vance", "ceo@test.com", "ceo", "Chief Executive Officer", base.depts.leadership._id, null);
      cadmin = await base.mk("Ravi", "Mehta", "cadmin@test.com", "company_admin", "Company Administrator", base.depts.leadership._id, base.users.priya._id);
      sadmin = await base.mk("Nadia", "Haddad", "sadmin@test.com", "super_admin", "Super Administrator", base.depts.leadership._id, base.users.priya._id);
    });

    it("CEO sees org-wide analytics (dashboard/payroll/recruitment)", async () => {
      const dash = await request(app).get("/api/hr/dashboard").set(base.auth(ceo));
      assert.equal(dash.status, 200);
      assert.equal(dash.body.data.dashboard.scope.type, "org");
      assert.ok(dash.body.data.dashboard.kpis.some((k) => k.id === "payroll"));
      const payroll = await request(app).get("/api/hr/payroll").set(base.auth(ceo));
      assert.equal(payroll.status, 200);
      const rec = await request(app).get("/api/hr/recruitment").set(base.auth(ceo));
      assert.equal(rec.status, 200);
    });

    it("CEO dashboard carries the Figma board block (revenue, priorities, snapshot) and other roles do not", async () => {
      const month = new Date();
      const key = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
      await RevenueRecord.create({ month: key, value: 103333 });
      const prev = new Date();
      prev.setMonth(prev.getMonth() - 1);
      await RevenueRecord.create({ month: prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0"), value: 95500 });
      await Initiative.create({ title: "Approve annual budget", area: "Finance", status: "pending", dueDate: addDays(new Date(), 45) });
      await Initiative.create({ title: "Review hiring plan", area: "HR", status: "review", dueDate: addDays(new Date(), 43) });
      await Initiative.create({ title: "ERP rollout", area: "IT", status: "healthy", dueDate: addDays(new Date(), 102) });
      await Initiative.create({ title: "Q4 strategy", area: "Leadership", status: "draft", dueDate: addDays(new Date(), 51) });

      const res = await request(app).get("/api/hr/dashboard").set(base.auth(ceo));
      assert.equal(res.status, 200);
      const ceoBlock = res.body.data.dashboard.ceo;
      assert.ok(ceoBlock, "ceo block present for the CEO role");
      assert.ok(ceoBlock.revenue && ceoBlock.revenue.annualized > 0);
      assert.ok(ceoBlock.headcount.value >= 1);
      assert.ok(ceoBlock.projects.value >= 2);
      assert.ok(Number.isInteger(ceoBlock.decisions.value));
      assert.ok(Array.isArray(ceoBlock.priorities) && ceoBlock.priorities.length === 4);
      assert.equal(ceoBlock.priorities[0].title, "Approve annual budget");
      assert.ok(ceoBlock.priorities.every((p) => p.title && p.area && p.status));
      const knownDepts = new Set(["Leadership", "Engineering", "Marketing", "People Ops"]);
      assert.ok(Array.isArray(ceoBlock.snapshot) && ceoBlock.snapshot.length >= 1);
      assert.ok(ceoBlock.snapshot.every((s) => knownDepts.has(s.dept) && s.pct >= 0 && s.pct <= 100));

      // The board block is MD/Executive-tier (CEO + executive share the figma board);
      // scoped leader roles still get their own dashboards without it.
      const execDash = await request(app).get("/api/hr/dashboard").set(base.auth(exec));
      assert.ok(execDash.body.data.dashboard.ceo);
      const mgrDash = await request(app).get("/api/hr/dashboard").set(base.auth(base.users.mike));
      assert.equal(mgrDash.body.data.dashboard.ceo ?? null, null);
    });

    it("priorities endpoint lists all initiatives for CEO but is gated from managers/employees", async () => {
      const res = await request(app).get("/api/hr/priorities").set(base.auth(ceo));
      assert.equal(res.status, 200);
      const rows = res.body.data.priorities;
      assert.ok(Array.isArray(rows) && rows.length >= 4);
      assert.ok(rows.every((r) => r.id && r.title && r.dueLabel && r.status));
      const managerDenied = await request(app).get("/api/hr/priorities").set(base.auth(base.users.mike));
      assert.equal(managerDenied.status, 403);
      const employeeDenied = await request(app).get("/api/hr/priorities").set(base.auth(base.users.jordan));
      assert.equal(employeeDenied.status, 403);
    });

    it("CEO has no per-employee or admin-CRUD powers", async () => {
      const tasks = await request(app).get("/api/hr/team-tasks").set(base.auth(ceo));
      assert.equal(tasks.status, 403);
      const createUser = await request(app).post("/api/users").set(base.auth(ceo)).send({ firstName: "X", lastName: "Y", email: "xy@test.com" });
      assert.equal(createUser.status, 403);
      const createDept = await request(app).post("/api/departments").set(base.auth(ceo)).send({ name: "Sneaky" });
      assert.equal(createDept.status, 403);
    });

    it("company admin manages users/departments and can decide requests org-wide", async () => {
      const created = await request(app).post("/api/users").set(base.auth(cadmin)).send({ firstName: "Grace", lastName: "Lin", email: "grace@test.com", role: "employee", department: String(base.depts.marketing._id), jobTitle: "Analyst" });
      assert.equal(created.status, 201);
      const dept = await request(app).post("/api/departments").set(base.auth(cadmin)).send({ name: "QA & Testing" });
      assert.equal(dept.status, 201);

      const req = await Request.create({
        requester: base.users.jordan._id,
        type: "leave",
        title: "Company admin approves",
        status: "pending",
        reviewer: base.users.mike._id,
        startDate: addDays(new Date(), 3),
        endDate: addDays(new Date(), 4),
      });
      const decided = await request(app).post(`/api/requests/${req._id}/approve`).set(base.auth(cadmin)).send({ note: "OK" });
      assert.equal(decided.status, 200);
      assert.equal(decided.body.data.request.status, "Approved");
    });

    it("company admin can write performance reviews like HR", async () => {
      const review = await PerformanceReview.create({
        user: base.users.david._id,
        reviewer: base.users.mike._id,
        period: "2026-Q3",
        score: 72,
        rating: "Meets expectations",
        status: "completed",
      });
      const patch = await request(app).patch(`/api/hr/performance/${review._id}`).set(base.auth(cadmin)).send({ score: 85, feedback: "Calibrated." });
      assert.equal(patch.status, 200);
      assert.equal(patch.body.data.review.score, 85);
    });

    it("super admin has full org access incl. team-task oversight", async () => {
      const dash = await request(app).get("/api/hr/dashboard").set(base.auth(sadmin));
      assert.equal(dash.status, 200);
      assert.equal(dash.body.data.dashboard.scope.type, "org");
      const tasks = await request(app).get("/api/hr/team-tasks").set(base.auth(sadmin));
      assert.equal(tasks.status, 200);
      const payroll = await request(app).get("/api/hr/payroll").set(base.auth(sadmin));
      assert.equal(payroll.status, 200);
      const dept = await request(app).post("/api/departments").set(base.auth(sadmin)).send({ name: "Platform Ops" });
      assert.equal(dept.status, 201);
    });
  });

  describe("hr portal (dashboard + lifecycle)", () => {
      before(async () => {
        const { OnboardingRecord, ONBOARDING_STEPS } = await import("../src/models/Lifecycle.js");
        const existing = await OnboardingRecord.findOne();
        if (existing) return;
        const newHire = await base.mk("Noman", "Aziz", "noman@test.com", "employee", "Junior Backend Engineer", base.depts.engineering, base.users.mike);
        await OnboardingRecord.create({
          user: newHire._id,
          jobTitle: "Junior Backend Engineer",
          department: base.depts.engineering,
          startDate: new Date(),
          steps: ONBOARDING_STEPS.map((label, i) => ({ label, done: i < 3 })),
          status: "in_progress",
        });
      });

      it("hr gets the portal dashboard with KPIs, approvals, attendance and events", async () => {
        const res = await request(app).get("/api/hr/portal/dashboard").set(base.auth(base.users.sana));
        assert.equal(res.status, 200);
        const p = res.body.data.portal;
        assert.ok(p.kpis.headcount >= 7);
        assert.equal(typeof p.kpis.pendingApprovals, "number");
        assert.ok(Array.isArray(p.approvals));
        assert.ok("present" in p.attendance);
        assert.ok(Array.isArray(p.events));
        assert.ok(p.activity.length >= 0);
      });

      it("lists onboarding with progress and toggles a checklist step", async () => {
        const list = await request(app).get("/api/hr/portal/onboarding").set(base.auth(base.users.sana));
        assert.equal(list.status, 200);
        const row = list.body.data.items[0];
        assert.ok(row.progress.total >= 9);
        assert.equal(row.progress.done, 3);

        const patch = await request(app).patch(`/api/hr/portal/onboarding/${row.id}`).set(base.auth(base.users.sana)).send({ stepIndex: 3, done: true });
        assert.equal(patch.status, 200);
        assert.equal(patch.body.data.item.progress.done, 4);
      });

      it("creates and deletes an offboarding record (hr only paths enforced)", async () => {
        const emp = await base.mk("Exit", "Test", "exittest@test.com", "employee", "QA", base.depts.engineering, base.users.mike);
        const create = await request(app).post("/api/hr/portal/offboarding").set(base.auth(base.users.sana)).send({ userId: String(emp._id), reason: "Resignation" });
        assert.equal(create.status, 201);
        const id = create.body.data.item.id;

        // employee role must be rejected (route gate)
        const jordanToken = base.auth(base.users.jordan);
        const forbidden = await request(app).get("/api/hr/portal/onboarding").set(jordanToken);
        assert.equal(forbidden.status, 403);

        const del = await request(app).delete(`/api/hr/portal/offboarding/${id}`).set(base.auth(base.users.sana));
        assert.equal(del.status, 204);
      });

      it("manager sees the portal dashboard scoped to their team", async () => {
        const res = await request(app).get("/api/hr/portal/dashboard").set(base.auth(nina));
        assert.equal(res.status, 200);
        assert.equal(res.body.data.portal.scope.type, "team");
      });
  });
});
