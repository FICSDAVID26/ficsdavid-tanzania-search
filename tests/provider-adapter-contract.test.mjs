import assert from "node:assert/strict";
import test from "node:test";
import {
  createDisabledProviderAdapter,
  validateProviderAdapter
} from "../functions/_shared/provider-adapter-contract.mjs";

test("disabled adapter implements the complete interface", () => {
  const adapter = createDisabledProviderAdapter({
    id: "selcom",
    name: "Selcom",
    service: "payments"
  });
  assert.equal(validateProviderAdapter(adapter).valid, true);
  assert.equal(adapter.enabled, false);
});

test("disabled adapter refuses every operation safely", async () => {
  const adapter = createDisabledProviderAdapter({
    id: "beem",
    name: "Beem Africa",
    service: "messaging"
  });
  for (const method of [
    "healthCheck", "getCapabilities", "quote", "createOrder",
    "getStatus", "verifyWebhook", "reconcile"
  ]) {
    const result = await adapter[method]({});
    assert.equal(result.ok, false);
    assert.equal(result.code, "PROVIDER_NOT_CONFIGURED");
  }
});

test("adapter contract reports missing methods", () => {
  const result = validateProviderAdapter({ healthCheck() {} });
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes("createOrder"));
});

test("adapter metadata is required", () => {
  assert.throws(() => createDisabledProviderAdapter({
    id: "", name: "Example", service: "payments"
  }), TypeError);
});

test("disabled adapter cannot be switched on by mutating its flag", () => {
  const adapter = createDisabledProviderAdapter({
    id: "selcom", name: "Selcom", service: "payments"
  });
  assert.throws(() => { adapter.enabled = true; }, TypeError);
  assert.equal(adapter.enabled, false);
});
