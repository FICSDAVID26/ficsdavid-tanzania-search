import test from "node:test";
import assert from "node:assert/strict";
import { reserveVerificationLimits } from "../functions/_shared/verification-rate-limit.js";

function makeRateLimit(results) {
  const calls = [];
  return {
    calls,
    async fn(db, key, limit, windowSeconds) {
      calls.push({ db, key, limit, windowSeconds });
      const result = results.shift();
      if (result instanceof Error) throw result;
      return result;
    }
  };
}

test("allows a request when both contact and network limits allow it", async () => {
  const limiter = makeRateLimit([
    { allowed: true, retryAfterSeconds: 0 },
    { allowed: true, retryAfterSeconds: 0 }
  ]);
  const db = {};
  const result = await reserveVerificationLimits(limiter.fn, db, "contact-key", "ip-key");
  assert.deepEqual(result, { allowed: true });
  assert.deepEqual(limiter.calls.map(call => [call.key, call.limit, call.windowSeconds]), [
    ["contact-key", 3, 3600],
    ["ip-key", 10, 3600]
  ]);
});

test("stops before checking network when the contact limit blocks", async () => {
  const limiter = makeRateLimit([{ allowed: false, retryAfterSeconds: 125 }]);
  const result = await reserveVerificationLimits(limiter.fn, {}, "contact-key", "ip-key", "email");
  assert.deepEqual(result, {
    allowed: false,
    scope: "email",
    retryAfterSeconds: 125
  });
  assert.equal(limiter.calls.length, 1);
});

test("returns network limit details after reserving the contact allowance", async () => {
  const limiter = makeRateLimit([
    { allowed: true, retryAfterSeconds: 0 },
    { allowed: false, retryAfterSeconds: 600 }
  ]);
  const result = await reserveVerificationLimits(limiter.fn, {}, "contact-key", "ip-key");
  assert.deepEqual(result, {
    allowed: false,
    scope: "network",
    retryAfterSeconds: 600
  });
  assert.equal(limiter.calls.length, 2);
});

test("propagates database errors instead of treating them as an allowed request", async () => {
  const failure = new Error("database unavailable");
  const limiter = makeRateLimit([failure]);
  await assert.rejects(
    reserveVerificationLimits(limiter.fn, {}, "contact-key", "ip-key"),
    /database unavailable/
  );
  assert.equal(limiter.calls.length, 1);
});

test("preserves phone as the contact limit scope", async () => {
  const limiter = makeRateLimit([{ allowed: false, retryAfterSeconds: 90 }]);
  const result = await reserveVerificationLimits(limiter.fn, {}, "contact-key", "ip-key", "phone");
  assert.deepEqual(result, {
    allowed: false,
    scope: "phone",
    retryAfterSeconds: 90
  });
  assert.equal(limiter.calls.length, 1);
});
