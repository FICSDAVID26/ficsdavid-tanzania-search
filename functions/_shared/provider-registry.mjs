// Server-side provider readiness registry.
// This module deliberately performs no outbound requests and exposes no credentials.
// Provider-specific network adapters must be added only after sandbox documentation,
// authentication and request/response schemas have been reviewed.

const PROVIDERS = Object.freeze([
  { id: "malipopay", name: "MALIPOPAY", service: "payments" },
  { id: "selcom", name: "Selcom", service: "payments" },
  { id: "beem", name: "Beem Africa", service: "messaging_airtime" },
  { id: "darsms", name: "DARSMS", service: "messaging" },
  { id: "bundle_aggregator", name: "Tanzania bundle aggregator", service: "bundles" },
  { id: "search_monetization", name: "Search monetization partner", service: "search" },
  { id: "ai_provider", name: "AI API provider", service: "ai" },
  { id: "webrtc_turn", name: "WebRTC/TURN provider", service: "realtime" }
]);

function envKey(providerId, suffix) {
  return "FICSD_PROVIDER_" + providerId.toUpperCase() + "_" + suffix;
}

function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname &&
      !url.username && !url.password;
  } catch (_) {
    return false;
  }
}

export function listProviderDefinitions() {
  return PROVIDERS.map(({ id, name, service }) => ({ id, name, service }));
}

export function getProviderReadiness(env, providerId) {
  const definition = PROVIDERS.find(item => item.id === providerId);
  if (!definition) return null;

  const enabled = env?.[envKey(providerId, "ENABLED")] === "true";
  const baseUrl = env?.[envKey(providerId, "BASE_URL")];
  const apiKey = env?.[envKey(providerId, "API_KEY")];
  const configured = isSafeHttpsUrl(baseUrl) &&
    typeof apiKey === "string" && apiKey.trim().length > 0;

  let status = "disabled";
  if (enabled && configured) status = "configured_pending_review";
  else if (enabled) status = "configuration_incomplete";

  return {
    id: definition.id,
    name: definition.name,
    service: definition.service,
    enabled,
    configured,
    status
  };
}

export function listProviderReadiness(env) {
  return PROVIDERS.map(({ id }) => getProviderReadiness(env, id));
}
