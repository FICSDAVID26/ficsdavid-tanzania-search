import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const html = read("index.html");
const api = read("functions/_shared/account-api.js");
const contacts = read("functions/_shared/communication-contacts.js");
const mobile = read("functions/_shared/mobile-messaging.js");
const route = read("functions/api/[[path]].js");
const readme = read("README.md");
const providerRegistry = read("docs/provider-registry.json");

test("main website exposes the first-release service areas", () => {
  for (const id of [
    "resultsPanel",
    "dataServicesPanel",
    "communicationCentre",
    "communicationContactsPanel",
    "ordinaryMobileCentre",
    "accountSection",
    "supportTicketForm",
    "helpCentrePanel"
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'), `Missing website section: ${id}`);
  }
  assert.match(html, /function setLanguage\(language\)/);
  assert.match(html, /data-en=/);
  assert.match(html, /data-sw=/);
});

test("search uses external sources with safe URL and text handling", () => {
  for (const name of ["searchKnowledge", "searchImages", "searchVideos", "searchNews"]) {
    assert.match(html, new RegExp("function " + name + "\\("));
  }
  assert.match(html, /function safeExternalUrl\(/);
  assert.match(html, /parsed\.protocol !== "https:"/);
  assert.match(html, /function escapeResultText\(/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("Cloudflare Pages routes API requests to the account API", () => {
  assert.match(route, /export async function onRequest\(context\)/);
  assert.match(route, /accountApi\.fetch\(context\.request, context\.env\)/);
  for (const endpoint of [
    "/api/auth/request-code",
    "/api/auth/verify-code",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout"
  ]) assert.ok(api.includes(endpoint), `Missing API endpoint: ${endpoint}`);
});

test("account API keeps core authentication safeguards", () => {
  assert.match(api, /PBKDF2/);
  assert.match(api, /PASSWORD_ITERATIONS = 310000/);
  assert.match(api, /__Host-ficsd_session=/);
  assert.match(api, /Secure; HttpOnly; SameSite=Lax/);
  assert.match(api, /function validOrigin\(/);
  assert.match(api, /if \(request\.method === "POST" && !validOrigin\(request\)\)/);
  assert.match(api, /registration: \{ email: emailConfigured, phone: phoneConfigured \}/);
  assert.match(api, /database_schema: "ready"/);
});

test("support tickets require same-origin requests and are rate limited", () => {
  const start = api.indexOf("async function createSupportTicket");
  const end = api.indexOf("\n}\n\nexport default", start);
  assert.ok(start >= 0 && end > start);
  const supportHandler = api.slice(start, end);
  assert.match(supportHandler, /validOrigin\(request\)/);
  assert.match(supportHandler, /rateLimit\(env\.DB/);
  assert.match(supportHandler, /support-ticket:/);
});

test("saved contacts use authenticated owner-scoped encrypted storage", () => {
  assert.match(contacts, /AES-GCM/);
  assert.match(contacts, /HMAC/);
  assert.match(contacts, /WHERE owner_user_id=\?/);
  assert.match(contacts, /DELETE FROM communication_contacts WHERE id=\? AND owner_user_id=\?/);
  assert.match(contacts, /if \(!user\) return json\(\{ error:/);
  assert.match(api, /handleCommunicationContacts/);
});

test("SMS queue is opt-in, authenticated and explicitly not provider-delivered", () => {
  assert.match(mobile, /consent_status/);
  assert.match(mobile, /purpose !== "service_updates"/);
  assert.match(mobile, /delivery: "not_enabled"/);
  assert.match(api, /handleMobileSms/);
});

test("migration files and README describe the same five schema changes", () => {
  const migrations = [
    "migrations/0001_account_foundation.sql",
    "migrations/0002_connected_services.sql",
    "migrations/0002_support_tickets.sql",
    "migrations/0003_mobile_sms_voice.sql",
    "migrations/0004_communication_contacts.sql"
  ];
  for (const path of migrations) {
    assert.ok(existsSync(new URL("../" + path, import.meta.url)), `Missing migration: ${path}`);
    assert.ok(readme.includes(path.split("/").pop()), `README omits migration: ${path}`);
  }
  assert.match(readme, /Five D1 migration files are present/);
});

test("secret values are not hard-coded in application source", () => {
  const source = [api, contacts, mobile, html].join("\n");
  for (const key of ["RESEND_API_KEY", "MOBILE_DATA_ENCRYPTION_KEY", "MOBILE_PHONE_HASH_KEY"]) {
    assert.ok(source.includes(key), `Expected environment variable reference: ${key}`);
    assert.doesNotMatch(source, new RegExp(key + '\\s*=\\s*["\\x60][^"\\x60]{8,}["\\x60]'));
  }
});

test("UI does not falsely claim that sign-in and registration are wholly inactive", () => {
  assert.match(html, /starter account API includes sign-in, contact verification and account creation/);
  assert.doesNotMatch(html, /Account creation, login, password reset, PIN verification and identity checks are not active/);
});


test("NIDA identity verification is visible but remains safely disabled pending official approval", () => {
  const registry = JSON.parse(providerRegistry);
  const nida = registry.providers.find(provider => provider.id === "nida-identity-verification");
  assert.ok(nida, "NIDA must be listed in the provider registry");
  assert.equal(nida.enabled, false);
  assert.equal(nida.status, "research");
  assert.match(nida.evidence, /formal data-sharing request/i);
  assert.match(html, /Tanzania NIDA Identity Verification/);
  assert.match(html, /OTP confirms contact ownership only/);
  assert.match(html, /OTP inathibitisha umiliki wa mawasiliano tu/);
});
