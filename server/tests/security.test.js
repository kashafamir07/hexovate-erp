import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, seedBase, startDb, stopDb } from "./helpers.js";

let base;

before(async () => {
  await startDb();
  base = await seedBase();
});

after(async () => {
  await stopDb();
});

beforeEach(async () => {
  const { Task } = await import("../src/models/Task.js");
  await Task.deleteMany({});
});

const auth = (u) => ({ Authorization: `Bearer ${base.token(u)}` });

describe("security headers (helmet)", () => {
  it("sets hardening headers on API responses", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["x-frame-options"], "frameguard header present");
    assert.ok(res.headers["strict-transport-security"], "HSTS header present");
    assert.ok(res.headers["x-dns-prefetch-control"]);
  });
});

describe("request body size caps", () => {
  it("rejects JSON bodies over 1mb with 413", async () => {
    const big = { payload: "x".repeat(1_600_000) };
    const res = await request(app).post("/api/auth/login").send(big);
    assert.equal(res.status, 413);
    assert.equal(res.body.success, false);
  });
});

describe("pagination caps", () => {
  it("clamps an excessive users limit to 100 and pages stay bounded", async () => {
    const res = await request(app).get("/api/users?limit=99999&page=999").set(auth(base.users.priya));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pagination.limit, 100);
    assert.equal(res.body.data.pagination.page, 999);
  });

  it("clamps task list to 200 and negative limits to 1", async () => {
    const big = await request(app).get("/api/tasks?limit=99999").set(auth(base.users.priya));
    assert.equal(big.body.data.pagination.limit, 200);
    const tiny = await request(app).get("/api/tasks?limit=-7").set(auth(base.users.priya));
    assert.equal(tiny.body.data.pagination.limit, 1);
  });

  it("clamps the HR attendance list (previously uncapped)", async () => {
    const res = await request(app).get("/api/hr/attendance?limit=99999").set(auth(base.users.sana));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pagination.limit, 200);
  });
});
