import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { Announcement } from "../src/models/Announcement.js";
import { Message } from "../src/models/Message.js";
import { Notification } from "../src/models/Notification.js";
import { Request } from "../src/models/Request.js";
import { app, seedBase, seedWork, startDb, stopDb } from "./helpers.js";

describe("requests, messages, announcements, notifications, dashboard, org-chart", () => {
  let base;
  let work;

  before(async () => {
    await startDb();
    base = await seedBase();
    work = await seedWork(base);
    await seedComms(base, work);
  });
  after(async () => {
    await stopDb();
  });

  async function seedComms(b, w) {
    const jordan = b.users.jordan;
    const mkReq = (requester, type, title, status, reviewer) =>
      Request.create({ requester: requester._id, type, title, status, reviewer: reviewer ? reviewer._id : null });
    // Auto-reviewer = manager: Jordan → Mike
    await mkReq(jordan, "leave", "Vacation — Family trip", "pending", b.users.mike);
    await mkReq(jordan, "expense", "Client dinner", "approved", b.users.mike);
    await mkReq(jordan, "equipment", "Figma renewal", "rejected", b.users.mike);
    await mkReq(jordan, "leave", "Personal day", "pending", b.users.mike);
    await mkReq(b.users.sarah, "expense", "Conference travel", "pending", b.users.alex);

    const ch = (name, sender, body, minutesAgo) =>
      Message.create({ channelName: name, sender: sender._id, recipients: [], body, createdAt: new Date(Date.now() - minutesAgo * 60000) });
    const dm = (a, b2, body, minutesAgo) =>
      Message.create({ sender: a._id, recipients: [a._id, b2._id], body, readBy: [a._id], createdAt: new Date(Date.now() - minutesAgo * 60000) });

    await ch("design-team", jordan, "Pushed tokens", 120);
    await ch("design-team", b.users.sarah, "Looks good", 60);
    await dm(jordan, b.users.sarah, "Sending wireframe", 90);
    await dm(b.users.mike, jordan, "Approved your leave", 30);
    await dm(b.users.alex, jordan, "Let's sync", 300);
    await dm(b.users.priya, jordan, "Great demo", 400);

    const notify = (user, type, title, message, minutesAgo) =>
      Notification.create({ user: user._id, type, title, message, createdAt: new Date(Date.now() - minutesAgo * 60000) });
    await notify(jordan, "task", "Task assigned to you", 'Sarah assigned "Update FAQ copy"', 10);
    await notify(jordan, "approval", "Leave approved", "Vacation approved", 60);
    await notify(jordan, "mention", "New mention", "Sarah mentioned you", 120);

    await Announcement.create({ title: "Office closed", content: "Holiday notice", author: b.users.sana._id, audience: "all", priority: "important", status: "published", publishedAt: new Date() });
    await Announcement.create({ title: "Expense rollout", content: "New tool", author: b.users.sana._id, audience: "all", priority: "normal", status: "published", publishedAt: new Date(Date.now() - 86400000) });
    void w;
  }

  describe("requests", () => {
    it("employee sees only their own requests", async () => {
      const res = await request(app).get("/api/requests").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.every((r) => r.approver === "Mike Chen"));
      assert.equal(res.body.data.items.length, 4);
    });

    it("employee creates a request; reviewer is auto-assigned from manager", async () => {
      const res = await request(app).post("/api/requests").set(base.auth(base.users.jordan)).send({
        type: "leave",
        title: "Extra vacation",
        startDate: new Date(Date.now() + 30 * 86400000),
        endDate: new Date(Date.now() + 32 * 86400000),
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.request.status, "Pending");
      assert.equal(res.body.data.request.approver, "Mike Chen");
    });

    it("validation rejects unknown types", async () => {
      const res = await request(app).post("/api/requests").set(base.auth(base.users.jordan)).send({ type: "holiday", title: "X" });
      assert.equal(res.status, 422);
    });

    it("manager review queue lists reports' requests", async () => {
      const res = await request(app).get("/api/requests?scope=reviewable").set(base.auth(base.users.mike));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 1);
    });

    it("employees cannot approve requests; the reviewer can", async () => {
      const pending = await Request.findOne({ requester: base.users.jordan._id, status: "pending", title: "Vacation — Family trip" });
      const asEmployee = await request(app).post(`/api/requests/${pending._id}/approve`).set(base.auth(base.users.david));
      assert.equal(asEmployee.status, 403);
      const approve = await request(app).post(`/api/requests/${pending._id}/approve`).set(base.auth(base.users.mike)).send({ note: "Enjoy!" });
      assert.equal(approve.status, 200);
      assert.equal(approve.body.data.request.status, "Approved");
    });

    it("requester receives a notification on decision", async () => {
      const res = await request(app).get("/api/notifications").set(base.auth(base.users.jordan));
      assert.ok(res.body.data.items.some((n) => n.title.includes("approved")));
    });

    it("owner withdraws only pending requests", async () => {
      const pending = await Request.findOne({ requester: base.users.jordan._id, status: "pending", title: "Personal day" });
      const res = await request(app).delete(`/api/requests/${pending._id}`).set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.request.status, "Withdrawn");
      const approved = await Request.findOne({ requester: base.users.jordan._id, status: "approved" });
      const again = await request(app).delete(`/api/requests/${approved._id}`).set(base.auth(base.users.jordan));
      assert.equal(again.status, 409);
    });
  });

  describe("messages", () => {
    it("lists the user's conversations (channels + DMs)", async () => {
      const res = await request(app).get("/api/messages").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      const convs = res.body.data.conversations;
      assert.ok(convs.some((c) => c.kind === "channel" && c.name === "design-team"));
      assert.ok(convs.some((c) => c.kind === "dm" && c.name === "Sarah Jenkins"));
      const designTeam = convs.find((c) => c.name === "design-team");
      assert.ok(designTeam.unread >= 1, "unread channel messages counted");
    });

    it("only shows DMs the user participates in", async () => {
      const res = await request(app).get("/api/messages").set(base.auth(base.users.david));
      const dms = res.body.data.conversations.filter((c) => c.kind === "dm").map((c) => c.name);
      // Channels are company-wide; DMs are strictly personal.
      assert.ok(!dms.some((n) => ["Sarah Jenkins", "Mike Chen", "Priya Nair"].includes(n)));
    });

    it("opens a conversation with message history", async () => {
      const res = await request(app).get("/api/messages").set(base.auth(base.users.jordan));
      const dm = res.body.data.conversations.find((c) => c.name === "Mike Chen");
      const open = await request(app).get(`/api/messages/${dm.id}`).set(base.auth(base.users.jordan));
      assert.equal(open.status, 200);
      assert.ok(open.body.data.conversation.messages.length >= 1);
    });

    it("marks a conversation read", async () => {
      const res = await request(app).get("/api/messages").set(base.auth(base.users.jordan));
      const dm = res.body.data.conversations.find((c) => c.name === "Mike Chen");
      const read = await request(app).patch(`/api/messages/${dm.id}/read`).set(base.auth(base.users.jordan));
      assert.equal(read.status, 200);
      const after = await request(app).get("/api/messages").set(base.auth(base.users.jordan));
      const updated = after.body.data.conversations.find((c) => c.name === "Mike Chen");
      assert.equal(updated.unread, 0);
    });

    it("sends a DM and a channel message", async () => {
      const dm = await request(app).post("/api/messages").set(base.auth(base.users.jordan)).send({ recipientId: base.users.sarah._id, body: "Heads up on the deadline" });
      assert.equal(dm.status, 201);
      const ch = await request(app).post("/api/messages").set(base.auth(base.users.jordan)).send({ channelName: "design-team", body: "Quick update for the team" });
      assert.equal(ch.status, 201);
    });

    it("message requires a body", async () => {
      const res = await request(app).post("/api/messages").set(base.auth(base.users.jordan)).send({ recipientId: base.users.sarah._id });
      assert.equal(res.status, 422);
    });
  });

  describe("announcements", () => {
    it("employees read announcements for them (pinned first)", async () => {
      const res = await request(app).get("/api/announcements").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.items.length, 2);
      assert.equal(res.body.data.items[0].pinned, true);
    });
    it("employees cannot create announcements; hr can", async () => {
      const emp = await request(app).post("/api/announcements").set(base.auth(base.users.jordan)).send({ title: "Nope", content: "X" });
      assert.equal(emp.status, 403);
      const hr = await request(app).post("/api/announcements").set(base.auth(base.users.sana)).send({ title: "Town hall", content: "Friday 10am" });
      assert.equal(hr.status, 201);
    });
    it("admin updates/deletes announcements", async () => {
      const created = await request(app).post("/api/announcements").set(base.auth(base.users.priya)).send({ title: "Roadmap", content: "Q4 roadmap" });
      const id = created.body.data.announcement.id;
      const patch = await request(app).patch(`/api/announcements/${id}`).set(base.auth(base.users.priya)).send({ content: "Q4 roadmap v2" });
      assert.equal(patch.status, 200);
      const del = await request(app).delete(`/api/announcements/${id}`).set(base.auth(base.users.priya));
      assert.equal(del.status, 204);
    });
  });

  describe("notifications", () => {
    it("lists user-specific notifications with unread count", async () => {
      const res = await request(app).get("/api/notifications").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 3);
      assert.ok(res.body.data.items.every((n) => n.id && n.title && n.icon && n.time));
      // every listed unread item is counted
      const unreadListed = res.body.data.items.filter((n) => !n.read).length;
      assert.ok(res.body.data.unread >= unreadListed);
      // seeded mock entries are present for the bell popover
      assert.ok(res.body.data.items.some((n) => n.title.includes("Task assigned")));
    });
    it("marks one read and read-all", async () => {
      const before = await request(app).get("/api/notifications").set(base.auth(base.users.jordan));
      const beforeCount = before.body.data.unread;
      const one = await request(app).patch(`/api/notifications/${before.body.data.items[0].id}/read`).set(base.auth(base.users.jordan));
      assert.equal(one.status, 200);
      const mid = await request(app).get("/api/notifications").set(base.auth(base.users.jordan));
      assert.equal(mid.body.data.unread, Math.max(0, beforeCount - 1));
      const all = await request(app).patch("/api/notifications/read-all").set(base.auth(base.users.jordan));
      assert.equal(all.status, 200);
      const after = await request(app).get("/api/notifications").set(base.auth(base.users.jordan));
      assert.equal(after.body.data.unread, 0);
    });
    it("cannot read another user's notification", async () => {
      const jordanN = await Notification.findOne({ user: base.users.jordan._id });
      const res = await request(app).patch(`/api/notifications/${jordanN._id}/read`).set(base.auth(base.users.david));
      assert.equal(res.status, 404);
    });
  });

  describe("dashboard", () => {
    it("returns every widget shape the dashboard UI renders", async () => {
      const res = await request(app).get("/api/dashboard").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      const d = res.body.data.dashboard;
      assert.ok(d.welcome.greeting.includes("Jordan"));
      assert.ok(Array.isArray(d.todaysTasks));
      assert.ok(Array.isArray(d.activeProjects));
      assert.ok(d.statItems.some((s) => s.label === "Hours Logged This Week"));
      assert.ok(Array.isArray(d.recentActivity));
      assert.ok(Array.isArray(d.upcomingDeadlines));
      assert.ok(d.counts.pendingRequests >= 0);
    });
    it("requires authentication", async () => {
      const res = await request(app).get("/api/dashboard");
      assert.equal(res.status, 401);
    });
  });

  describe("org chart", () => {
    it("returns a root with nested nodes", async () => {
      const res = await request(app).get("/api/org-chart").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      const { root, nodes } = res.body.data;
      assert.equal(root.name, "Priya Nair");
      assert.ok(root.reports.length >= 2);
      assert.ok(nodes[root.id].reportsCount >= 1);
      assert.ok(Object.values(nodes).some((n) => n.dept === "engineering"));
    });
  });
});
