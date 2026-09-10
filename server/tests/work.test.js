import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { TimeEntry } from "../src/models/TimeEntry.js";
import { Timesheet } from "../src/models/Timesheet.js";
import { app, seedBase, seedWork, startDb, stopDb, thisWeek } from "./helpers.js";

describe("projects, tasks, time, timesheets", () => {
  let base;
  let work;

  before(async () => {
    await startDb();
    base = await seedBase();
    work = await seedWork(base);
  });
  after(async () => {
    await stopDb();
  });

  describe("projects", () => {
    it("lists projects with members", async () => {
      const res = await request(app).get("/api/projects").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.items.length, 2);
      assert.equal(res.body.data.items[0].memberTotal, 3);
    });

    it("filters by status", async () => {
      const res = await request(app).get("/api/projects?status=active").set(base.auth(base.users.jordan));
      assert.ok(res.body.data.items.every((p) => p.status === "Active"));
    });

    it("employees cannot create projects; managers can", async () => {
      const emp = await request(app).post("/api/projects").set(base.auth(base.users.jordan)).send({ name: "Nope" });
      assert.equal(emp.status, 403);
      const mgr = await request(app).post("/api/projects").set(base.auth(base.users.mike)).send({ name: "Internal Tooling", status: "active", members: [base.users.jordan._id], dueDate: new Date() });
      assert.equal(mgr.status, 201);
    });

    it("project detail returns stats", async () => {
      const res = await request(app).get(`/api/projects/${work.project._id}`).set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.stats.total, 3);
      assert.equal(res.body.data.stats.completed, 1);
      assert.ok(res.body.data.project.budget.total > 0);
    });

    it("kanban board groups tasks by column", async () => {
      const res = await request(app).get(`/api/projects/${work.project._id}/board`).set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      const cols = res.body.data.columns.map((c) => c.status);
      assert.ok(cols.includes("In Progress"));
      assert.ok(cols.includes("Done"));
      assert.equal(res.body.data.columns.reduce((n, c) => n + c.tasks.length, 0), 3);
    });

    it("members can be added and removed by managers", async () => {
      const add = await request(app).post(`/api/projects/${work.project._id}/members`).set(base.auth(base.users.alex)).send({ userId: base.users.sana._id });
      assert.equal(add.status, 200);
      const remove = await request(app).delete(`/api/projects/${work.project._id}/members/${base.users.sana._id}`).set(base.auth(base.users.alex));
      assert.equal(remove.status, 200);
    });

    it("employee cannot delete a project", async () => {
      const res = await request(app).delete(`/api/projects/${work.erp._id}`).set(base.auth(base.users.jordan));
      assert.equal(res.status, 403);
    });
  });

  describe("tasks", () => {
    it("employee task list is scoped to their assignments", async () => {
      const res = await request(app).get("/api/tasks").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.every((t) => t.title !== "Build nav component"), "david's task must not leak");
      assert.ok(res.body.data.items.some((t) => t.title === "Design pricing page"));
    });

    it("manager sees all tasks and can filter by project", async () => {
      const all = await request(app).get("/api/tasks?assigned=all").set(base.auth(base.users.mike));
      assert.equal(all.body.data.pagination.total, 4);
      const byProject = await request(app).get(`/api/tasks?project=${work.project._id}`).set(base.auth(base.users.mike));
      assert.equal(byProject.body.data.pagination.total, 3);
    });

    it("task list supports status/priority/due filters + search", async () => {
      const done = await request(app).get("/api/tasks?status=completed&assigned=all").set(base.auth(base.users.mike));
      assert.equal(done.body.data.pagination.total, 1);
      const search = await request(app).get("/api/tasks?search=pricing").set(base.auth(base.users.jordan));
      assert.ok(search.body.data.items.some((t) => t.title.includes("pricing")));
      const todayDue = await request(app).get("/api/tasks?due=today").set(base.auth(base.users.jordan));
      assert.equal(todayDue.status, 200);
    });

    it("employee can create a task in their project", async () => {
      const res = await request(app).post("/api/tasks").set(base.auth(base.users.jordan)).send({
        title: "Homepage QA pass",
        project: work.project._id,
        assignedTo: base.users.jordan._id,
        priority: "low",
        dueDate: new Date(Date.now() + 4 * 86400000),
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.task.done, false);
    });

    it("task completion + status transitions", async () => {
      const id = work.tasks.t1._id;
      const complete = await request(app).patch(`/api/tasks/${id}/complete`).set(base.auth(base.users.jordan)).send({ done: true });
      assert.equal(complete.status, 200);
      assert.equal(complete.body.data.task.done, true);
      assert.equal(complete.body.data.task.status, "Done");
      const toReview = await request(app).patch(`/api/tasks/${id}/status`).set(base.auth(base.users.jordan)).send({ status: "review" });
      assert.equal(toReview.body.data.task.status, "In Review");
    });

    it("employees cannot update tasks that are not theirs", async () => {
      const res = await request(app).patch(`/api/tasks/${work.tasks.t2._id}/complete`).set(base.auth(base.users.jordan)).send({ done: true });
      assert.equal(res.status, 403);
    });

    it("managers can reassign tasks", async () => {
      const res = await request(app).patch(`/api/tasks/${work.tasks.t4._id}`).set(base.auth(base.users.mike)).send({ assignedTo: base.users.david._id });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.task.id, String(work.tasks.t4._id));
    });

    it("employee can delete own assigned task", async () => {
      const t = await request(app).post("/api/tasks").set(base.auth(base.users.jordan)).send({ title: "Temp task", assignedTo: base.users.jordan._id });
      const del = await request(app).delete(`/api/tasks/${t.body.data.task.id}`).set(base.auth(base.users.jordan));
      assert.equal(del.status, 204);
    });

    it("invalid task ids return 400", async () => {
      const res = await request(app).get("/api/tasks/not-an-id").set(base.auth(base.users.jordan));
      assert.equal(res.status, 400);
    });
  });

  describe("time tracking", () => {
    it("starts and reports a single running timer", async () => {
      const start = await request(app).post("/api/time/start").set(base.auth(base.users.jordan)).send({ project: work.project._id, task: work.tasks.t1._id, description: "Pricing work" });
      assert.equal(start.status, 201);
      const dup = await request(app).post("/api/time/start").set(base.auth(base.users.jordan)).send({ project: work.project._id });
      assert.equal(dup.status, 409, "second active timer blocked");
      const current = await request(app).get("/api/time/current").set(base.auth(base.users.jordan));
      assert.equal(current.status, 200);
      assert.equal(current.body.data.current.project, "Website Redesign");
    });

    it("stops the timer and stores duration", async () => {
      const stop = await request(app).post("/api/time/stop").set(base.auth(base.users.jordan));
      assert.equal(stop.status, 200);
      assert.ok(stop.body.data.entry.minutes >= 0);
      assert.equal(stop.body.data.entry.project, "Website Redesign");
    });

    it("cannot stop when no timer is running", async () => {
      const res = await request(app).post("/api/time/stop").set(base.auth(base.users.jordan));
      assert.equal(res.status, 404);
    });

    it("lists entries for the week and includes manual entries", async () => {
      await request(app).post("/api/time").set(base.auth(base.users.jordan)).send({ project: work.erp._id, taskName: "Planning", date: new Date(), minutes: 45, billable: false });
      const res = await request(app).get("/api/time?scope=week").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 1);
      assert.ok(res.body.data.items.some((e) => e.manual));
    });

    it("time summary aggregates minutes", async () => {
      const res = await request(app).get("/api/time/summary?scope=week").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.summary.totalMinutes >= 45);
      assert.ok(res.body.data.summary.byProject.length >= 1);
    });

    it("updates and deletes own time entries", async () => {
      const entry = await TimeEntry.create({ user: base.users.jordan._id, projectName: "Internal", taskName: "1:1", date: new Date(), duration: 30, billable: false, status: "stopped", manual: true });
      const patch = await request(app).patch(`/api/time/${entry._id}`).set(base.auth(base.users.jordan)).send({ billable: true, duration: 60 });
      assert.equal(patch.status, 200);
      assert.equal(patch.body.data.entry.billable, "Billable");
      const del = await request(app).delete(`/api/time/${entry._id}`).set(base.auth(base.users.jordan));
      assert.equal(del.status, 204);
    });
  });

  describe("timesheets", () => {
    it("current week view returns the grid shape", async () => {
      const res = await request(app).get("/api/timesheets/mine/current").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      const ts = res.body.data.timesheet;
      assert.equal(ts.days.length, 7);
      assert.ok(ts.rows.length >= 0);
      assert.equal(typeof ts.grandTotal, "string");
    });

    it("creates + submits a timesheet", async () => {
      const entries = await TimeEntry.find({ user: base.users.jordan._id, date: { $gte: thisWeek() } }).limit(3);
      const create = await request(app).post("/api/timesheets").set(base.auth(base.users.jordan)).send({ entries: entries.map((e) => e._id) });
      assert.equal(create.status, 201);
      const submit = await request(app).post(`/api/timesheets/${create.body.data.timesheet.id}/submit`).set(base.auth(base.users.jordan));
      assert.equal(submit.status, 200);
      assert.equal(submit.body.data.timesheet.status, "submitted");
    });

    it("owner cannot approve their own sheet; manager can", async () => {
      const sheet = await Timesheet.findOne({ user: base.users.jordan._id, status: "submitted" });
      assert.ok(sheet);
      const selfApprove = await request(app).post(`/api/timesheets/${sheet._id}/approve`).set(base.auth(base.users.jordan));
      assert.equal(selfApprove.status, 403);
      const approve = await request(app).post(`/api/timesheets/${sheet._id}/approve`).set(base.auth(base.users.mike)).send({ note: "Nice work" });
      assert.equal(approve.status, 200);
      assert.equal(approve.body.data.timesheet.status, "approved");
      const again = await request(app).post(`/api/timesheets/${sheet._id}/approve`).set(base.auth(base.users.mike));
      assert.equal(again.status, 409);
    });

    it("employee role cannot review other sheets", async () => {
      const sheets = await request(app).get("/api/timesheets").set(base.auth(base.users.jordan));
      assert.ok(sheets.body.data.items.every((s) => s.user === "Jordan Cole"));
    });
  });
});
