import assert from "node:assert/strict";
import test from "node:test";
import {
  getProviderReadiness,
  listProviderDefinitions,
  listProviderReadiness
} from "../functions/_shared/provider-registry.js";

test("provider catalogue is metadata-only and starts disabled", () => {
  const providers = listProviderReadiness({});
  assert.ok(providers.length >= 8);
  assert.ok(providers.every(provider => provider.enabled === false));
  assert.ok(providers.every(provider => provider.status === "disabled"));
});

test("unknown provider identifiers are rejected", () => {
  assert.equal(getProviderReadiness({}, "unknown_provider"), null);
});

test("provider is not ready when enabled without complete HTTPS credentials", () => {
  const result = getProviderReadiness({
    FICSD_PROVIDER_SELCOM_ENABLED: "true",
    FICSD_PROVIDER_SELCOM_BASE_URL: "http://example.test",
    FICSD_PROVIDER_SELCOM_API_KEY: "test-secret"
  }, "selcom");
  assert.equal(result.status, "configuration_incomplete");
  assert.equal(result.configured, false);
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("configured provider status never returns credentials or base URL", () => {
  const result = getProviderReadiness({
    FICSD_PROVIDER_MALIPOPAY_ENABLED: "true",
    FICSD_PROVIDER_MALIPOPAY_BASE_URL: "https://sandbox.example.test/api",
    FICSD_PROVIDER_MALIPOPAY_API_KEY: "private-test-key"
  }, "malipopay");
  assert.equal(result.status, "configured_pending_review");
  assert.equal(result.configured, true);
  assert.equal(JSON.stringify(result).includes("private-test-key"), false);
  assert.equal(JSON.stringify(result).includes("sandbox.example.test"), false);
});

test("provider requires explicit lowercase true to enable", () => {
  const result = getProviderReadiness({
    FICSD_PROVIDER_BEEM_ENABLED: "TRUE",
    FICSD_PROVIDER_BEEM_BASE_URL: "https://api.example.test",
    FICSD_PROVIDER_BEEM_API_KEY: "private-test-key"
  }, "beem");
  assert.equal(result.enabled, false);
  assert.equal(result.status, "disabled");
});

test("provider definitions expose only safe integration metadata", () => {
  const definitions = listProviderDefinitions();
  assert.ok(definitions.some(provider => provider.id === "bundle_aggregator"));
  assert.ok(definitions.every(provider => !("apiKey" in provider)));
});
