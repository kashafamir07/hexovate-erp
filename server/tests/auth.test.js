import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { app, seedBase, startDb, stopDb } from "./helpers.js";

describe("auth + users", () => {
  let base;

  before(async () => {
    await startDb();
    base = await seedBase();
  });
  after(async () => {
    await stopDb();
  });

  it("health endpoint is open", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it("register creates an employee account", async () => {
    const res = await request(app).post("/api/auth/register").send({
      firstName: "New",
      lastName: "Hire",
      email: "new.hire@test.com",
      password: "Password123!",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, "employee");
    assert.equal(res.body.data.user.email, "new.hire@test.com");
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.passwordHash, undefined);
  });

  it("register validates input", async () => {
    const res = await request(app).post("/api/auth/register").send({ firstName: "A", email: "bad", password: "x" });
    assert.equal(res.status, 422);
    assert.ok(res.body.errors.length >= 2);
  });

  it("register rejects duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({ firstName: "Dup", lastName: "User", email: "jordan@test.com", password: "Password123!" });
    assert.equal(res.status, 409);
  });

  it("login fails with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "jordan@test.com", password: "wrongpass1" });
    assert.equal(res.status, 401);
  });

  it("login succeeds and /me returns the user", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: "jordan@test.com", password: "Password123!" });
    assert.equal(login.status, 200);
    assert.ok(login.body.data.accessToken);
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.data.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, "jordan@test.com");
    assert.equal(me.body.data.user.role, "employee");
  });

  it("protected routes reject missing/invalid tokens", async () => {
    const noToken = await request(app).get("/api/auth/me");
    assert.equal(noToken.status, 401);
    const bad = await request(app).get("/api/auth/me").set("Authorization", "Bearer nope.invalid.token");
    assert.equal(bad.status, 401);
  });

  it("refresh endpoint rejects without a refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh");
    assert.equal(res.status, 401);
  });

  describe("role authorization", () => {
    it("employee cannot create users", async () => {
      const res = await request(app).post("/api/users").set(base.auth(base.users.jordan)).send({ firstName: "X", lastName: "Y", email: "x@test.com", password: "Password123!" });
      assert.equal(res.status, 403);
    });

    it("admin and hr can create users", async () => {
      for (const who of [base.users.priya, base.users.sana]) {
        const res = await request(app).post("/api/users").set(base.auth(who)).send({ firstName: "Added", lastName: "User", email: `added-${who.role}@test.com`, password: "Password123!", role: "employee" });
        assert.equal(res.status, 201);
      }
    });

    it("admin can delete a user; employee cannot", async () => {
      const created = await request(app).post("/api/users").set(base.auth(base.users.priya)).send({ firstName: "Temp", lastName: "Gone", email: "temp.gone@test.com", password: "Password123!" });
      const id = created.body.data.user.id;
      const asEmployee = await request(app).delete(`/api/users/${id}`).set(base.auth(base.users.jordan));
      assert.equal(asEmployee.status, 403);
      const asAdmin = await request(app).delete(`/api/users/${id}`).set(base.auth(base.users.priya));
      assert.equal(asAdmin.status, 204);
    });
  });

  describe("users listing & access", () => {
    it("employee list only returns themselves", async () => {
      const res = await request(app).get("/api/users").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.pagination.total, 1);
    });

    it("admin sees everyone with pagination metadata", async () => {
      const res = await request(app).get("/api/users?limit=3&page=1").set(base.auth(base.users.priya));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length <= 3);
      assert.ok(res.body.data.pagination.total >= 7);
    });

    it("users list supports search", async () => {
      const res = await request(app).get("/api/users?search=cole").set(base.auth(base.users.priya));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.some((u) => u.email === "jordan@test.com"));
    });

    it("employee cannot view another employee's profile", async () => {
      const res = await request(app).get(`/api/users/${base.users.david._id}`).set(base.auth(base.users.jordan));
      assert.equal(res.status, 403);
    });

    it("manager can view direct reports only", async () => {
      const report = await request(app).get(`/api/users/${base.users.david._id}`).set(base.auth(base.users.mike));
      assert.equal(report.status, 200);
      const stranger = await request(app).get(`/api/users/${base.users.jordan._id}`).set(base.auth(base.users.sarah));
      assert.equal(stranger.status, 403);
    });

    it("employee can view and update their own profile", async () => {
      const view = await request(app).get(`/api/users/${base.users.jordan._id}`).set(base.auth(base.users.jordan));
      assert.equal(view.status, 200);
      const patch = await request(app).patch(`/api/users/${base.users.jordan._id}`).set(base.auth(base.users.jordan)).send({ phone: "+1 555 0001" });
      assert.equal(patch.status, 200);
      assert.equal(patch.body.data.user.phone, "+1 555 0001");
      // role escalation via the profile endpoint is forbidden
      const escalate = await request(app).patch(`/api/users/${base.users.jordan._id}`).set(base.auth(base.users.jordan)).send({ role: "admin" });
      assert.equal(escalate.status, 403);
    });

    it("own-password change validates the current password", async () => {
      const wrong = await request(app).patch("/api/users/me/password").set(base.auth(base.users.jordan)).send({ currentPassword: "nope", newPassword: "BrandNewPassword1" });
      assert.equal(wrong.status, 400);
      const ok = await request(app).patch("/api/users/me/password").set(base.auth(base.users.jordan)).send({ currentPassword: "Password123!", newPassword: "BrandNewPassword1" });
      assert.equal(ok.status, 200);
      const relogin = await request(app).post("/api/auth/login").send({ email: "jordan@test.com", password: "BrandNewPassword1" });
      assert.equal(relogin.status, 200);
    });
  });

  describe("departments", () => {
    it("any authenticated user lists departments", async () => {
      const res = await request(app).get("/api/departments").set(base.auth(base.users.jordan));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 4);
    });
    it("employee cannot manage departments; hr can", async () => {
      const asEmployee = await request(app).post("/api/departments").set(base.auth(base.users.jordan)).send({ name: "Blocked" });
      assert.equal(asEmployee.status, 403);
      const asHr = await request(app).post("/api/departments").set(base.auth(base.users.sana)).send({ name: "Legal" });
      assert.equal(asHr.status, 201);
    });
  });

  it("unknown routes return a 404 JSON body", async () => {
    const authed = await request(app).get("/api/definitely-not-here").set(base.auth(base.users.jordan));
    assert.equal(authed.status, 404);
    assert.equal(authed.body.success, false);
    const bare = await request(app).get("/api/definitely-not-here");
    assert.equal(bare.status, 404);
  });
});
