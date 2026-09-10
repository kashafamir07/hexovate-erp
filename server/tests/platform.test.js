import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, seedBase, startDb, stopDb } from "./helpers.js";

let base;
let nadia;
let ravi;

before(async () => {
  await startDb();
  base = await seedBase();
  nadia = await base.mk("Nadia", "Haddad", "nadia@test.com", "super_admin", "Super Administrator", base.depts.leadership._id);
  ravi = await base.mk("Ravi", "Mehta", "ravi@test.com", "company_admin", "Company Administrator", base.depts.leadership._id);
});

after(async () => {
  await stopDb();
});

beforeEach(async () => {
  const { Company } = await import("../src/models/Company.js");
  const { AuditLog } = await import("../src/models/AuditLog.js");
  const { SupportTicket } = await import("../src/models/SupportTicket.js");
  await Company.deleteMany({});
  await AuditLog.deleteMany({});
  await SupportTicket.deleteMany({});
});

const auth = (u) => ({ Authorization: `Bearer ${base.token(u)}` });

describe("platform API role gates", () => {
  it("rejects employees, managers and company admins", async () => {
    for (const u of [base.users.jordan, base.users.mike, ravi]) {
      const res = await request(app).get("/api/platform/dashboard").set(auth(u));
      assert.equal(res.status, 403, `${u.role} must not reach platform API`);
      assert.equal(res.body.success, false);
    }
  });

  it("rejects anonymous requests", async () => {
    const res = await request(app).get("/api/platform/dashboard");
    assert.equal(res.status, 401);
  });

  it("allows the super admin", async () => {
    const res = await request(app).get("/api/platform/dashboard").set(auth(nadia));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.kpis.length >= 4);
  });
});

describe("platform companies", () => {
  it("creates, lists, updates and deletes a company (with audit trail)", async () => {
    const created = await request(app)
      .post("/api/platform/companies")
      .set(auth(nadia))
      .send({ name: "Acme Labs", domain: "acme.io", industry: "Dev Tools", plan: "business", seats: 25 });
    assert.equal(created.status, 201);
    const id = created.body.data.company.id;

    const list = await request(app).get("/api/platform/companies?search=acme&plan=business").set(auth(nadia));
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.items[0].planLabel, "Business");

    const updated = await request(app).patch(`/api/platform/companies/${id}`).set(auth(nadia)).send({ plan: "enterprise", status: "active", seats: 40 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.company.plan, "enterprise");

    const audit = await request(app).get("/api/platform/audit?search=Acme").set(auth(nadia));
    assert.ok(audit.body.data.items.some((a) => a.action === "Company created"));

    const dup = await request(app).post("/api/platform/companies").set(auth(nadia)).send({ name: "Acme Labs" });
    assert.equal(dup.status, 409);

    const del = await request(app).delete(`/api/platform/companies/${id}`).set(auth(nadia));
    assert.equal(del.status, 204);
  });
});

describe("platform subscriptions", () => {
  it("returns plan mix, MRR summary and rows", async () => {
    const { Company } = await import("../src/models/Company.js");
    await Company.create([
      { name: "One", plan: "enterprise", status: "active", seats: 10 },
      { name: "Two", plan: "business", status: "active", seats: 10 },
      { name: "Three", plan: "trial", status: "trial", seats: 5 },
    ]);
    const res = await request(app).get("/api/platform/subscriptions").set(auth(nadia));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.items.length, 3);
    assert.ok(res.body.data.summary.mrr > 0);
    assert.equal(res.body.data.byPlan.length, 3);
  });
});

describe("platform support tickets", () => {
  it("creates, filters and resolves tickets", async () => {
    const created = await request(app)
      .post("/api/platform/tickets")
      .set(auth(nadia))
      .send({ companyName: "Acme Labs", subject: "SSO failures", description: "Cannot provision users", priority: "high", reporter: "Dana" });
    assert.equal(created.status, 201);
    const id = created.body.data.ticket.id;

    const open = await request(app).get("/api/platform/tickets?status=open").set(auth(nadia));
    assert.ok(open.body.data.items.some((t) => t.id === id));

    const resolved = await request(app).patch(`/api/platform/tickets/${id}`).set(auth(nadia)).send({ status: "resolved" });
    assert.equal(resolved.body.data.ticket.status, "resolved");

    const audit = await request(app).get("/api/platform/audit?category=support").set(auth(nadia));
    assert.ok(audit.body.data.items.length >= 1);
  });
});

describe("platform system health", () => {
  it("reports services and storage counts", async () => {
    const res = await request(app).get("/api/platform/health").set(auth(nadia));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.services.length >= 4);
    assert.ok(res.body.data.storage.users >= 1);
    assert.ok(res.body.data.checkedAt);
  });
});

describe("password reset flow", () => {
  it("forgot-password issues a dev token and reset-password swaps it for a new password", async () => {
    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: "jordan@test.com" });
    assert.equal(forgot.status, 200);
    const devToken = forgot.body.data.devToken;
    assert.ok(devToken, "dev token should be returned outside production");

    // unknown email still returns 200 with no token (no user enumeration)
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "ghost@test.com" });
    assert.equal(unknown.status, 200);
    assert.equal(unknown.body.data.devToken, undefined);

    const reset = await request(app).post("/api/auth/reset-password").send({ token: devToken, newPassword: "FreshPass123!" });
    assert.equal(reset.status, 200);

    const oldLogin = await request(app).post("/api/auth/login").send({ email: "jordan@test.com", password: "Password123!" });
    assert.equal(oldLogin.status, 401);

    const newLogin = await request(app).post("/api/auth/login").send({ email: "jordan@test.com", password: "FreshPass123!" });
    assert.equal(newLogin.status, 200);

    // token is single-use
    const reuse = await request(app).post("/api/auth/reset-password").send({ token: devToken, newPassword: "AnotherPass123!" });
    assert.equal(reuse.status, 400);

    // restore the password so other tests keep passing
    const { User } = await import("../src/models/User.js");
    const jordan = await User.findOne({ email: "jordan@test.com" });
    jordan.passwordHash = base.hash; // restore Password123!
    await jordan.save();
  });
});
