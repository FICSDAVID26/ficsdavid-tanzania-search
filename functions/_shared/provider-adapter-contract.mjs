// Provider adapter contract guard.
// This validates adapter shape only; it does not execute provider operations.
const REQUIRED_METHODS = Object.freeze([
  "healthCheck",
  "getCapabilities",
  "quote",
  "createOrder",
  "getStatus",
  "verifyWebhook",
  "reconcile"
]);

export function validateProviderAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    return { valid: false, missing: [...REQUIRED_METHODS] };
  }
  const missing = REQUIRED_METHODS.filter(name => typeof adapter[name] !== "function");
  return { valid: missing.length === 0, missing };
}

export function createDisabledProviderAdapter({ id, name, service }) {
  if (![id, name, service].every(value => typeof value === "string" && value.trim())) {
    throw new TypeError("Provider id, name and service are required.");
  }

  const unavailable = async () => ({
    ok: false,
    code: "PROVIDER_NOT_CONFIGURED",
    message: "Provider integration is not configured or approved."
  });

  return Object.freeze({
    id,
    name,
    service,
    enabled: false,
    healthCheck: unavailable,
    getCapabilities: unavailable,
    quote: unavailable,
    createOrder: unavailable,
    getStatus: unavailable,
    verifyWebhook: unavailable,
    reconcile: unavailable
  });
}
