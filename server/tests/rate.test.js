// Rate-limit verification. This file deliberately has NO static imports from
// the app/helpers: env vars must be set before env.js is evaluated, so the
// app is loaded dynamically after configuration. A tiny in-memory MongoDB
// backs the login controller (limiters fire first, but the 401 path still
// queries the users collection).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

let rateApp;
let apiLimiter;
let authLimiter;
let mongo;
let mongoose;

before(async () => {
  process.env.RATE_LIMIT_AUTH_MAX = "3";
  process.env.RATE_LIMIT_API_MAX = "5";
  process.env.RATE_LIMIT_ENABLED = "true";
  // NODE_ENV must not be "test" or the limiters skip themselves.
  delete process.env.NODE_ENV;

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongo = await MongoMemoryServer.create();
  mongoose = (await import("mongoose")).default;
  await mongoose.connect(mongo.getUri());

  const { createApp } = await import("../src/app.js");
  ({ apiLimiter, authLimiter } = await import("../src/middleware/security.js"));
  rateApp = createApp();
});

after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// supertest always connects from the loopback v4-mapped address.
const resetStores = async () => {
  for (const limiter of [authLimiter, apiLimiter]) {
    await limiter.resetKey("::ffff:127.0.0.1");
    await limiter.resetKey("127.0.0.1");
  }
};

describe("rate limiting", () => {
  it("throttles repeated auth attempts with a JSON 429", async () => {
    await resetStores();
    const attempt = () => request(rateApp).post("/api/auth/login").send({ email: "nobody@test.com", password: "wrong" });
    assert.equal((await attempt()).status, 401); // first: normal auth failure
    assert.equal((await attempt()).status, 401); // second
    assert.equal((await attempt()).status, 401); // third
    const blocked = await attempt(); // fourth exceeds RATE_LIMIT_AUTH_MAX=3
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.success, false);
    assert.ok(blocked.headers["ratelimit-limit"], "RateLimit headers present");
  });

  it("throttles the global API budget independently", async () => {
    await resetStores();
    const hits = [];
    for (let i = 0; i < 6; i += 1) {
      hits.push((await request(rateApp).get("/api/health")).status);
    }
    assert.deepEqual(hits.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.equal(hits[5], 429);
  });

  it("returns the documented error shape and a Retry-After header", async () => {
    await resetStores();
    for (let i = 0; i < 4; i += 1) {
      await request(rateApp).post("/api/auth/login").send({ email: "x@test.com", password: "wrong" });
    }
    const blocked = await request(rateApp).post("/api/auth/login").send({ email: "x@test.com", password: "wrong" });
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { success: false, message: "Too many requests, please try again later", errors: [] });
    assert.ok(blocked.headers["retry-after"], "Retry-After header present");
  });
});