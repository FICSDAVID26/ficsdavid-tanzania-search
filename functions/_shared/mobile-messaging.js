// FICSDavid SMS queue foundation. No provider delivery is performed by this module.
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(value) {
  const s = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
}
async function digestPhone(value, env) {
  if (!env.MOBILE_PHONE_HASH_KEY) throw new Error("HASH_KEY_NOT_CONFIGURED");
  const raw = fromB64url(env.MOBILE_PHONE_HASH_KEY);
  if (raw.length !== 32) throw new Error("HASH_KEY_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("ficsd-mobile-phone:" + value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function encrypt(value, env) {
  if (!env.MOBILE_DATA_ENCRYPTION_KEY) throw new Error("ENCRYPTION_NOT_CONFIGURED");
  let raw;
  try { raw = fromB64url(env.MOBILE_DATA_ENCRYPTION_KEY); } catch (_) { throw new Error("ENCRYPTION_NOT_CONFIGURED"); }
  if (raw.length !== 32) throw new Error("ENCRYPTION_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return b64url(combined);
}
async function readBody(request) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) return null;
  const raw = await request.text();
  if (raw.length > 4096) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
async function limit(db, key, maximum, seconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`INSERT INTO rate_limits(rate_key,window_start,request_count) VALUES(?,?,1)
    ON CONFLICT(rate_key) DO UPDATE SET
    request_count=CASE WHEN window_start<=? THEN 1 ELSE request_count+1 END,
    window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END
    RETURNING request_count`).bind(key, now, now-seconds, now-seconds).first();
  return !!row && row.request_count <= maximum;
}
async function audit(db, userId, eventType, referenceId, metadata = {}) {
  await db.prepare("INSERT INTO service_audit_events(id,user_id,service_name,event_type,reference_id,created_at,metadata_json) VALUES(?,?,'communication',?,?,?,?)")
    .bind(crypto.randomUUID(), userId, eventType, referenceId || null, Math.floor(Date.now()/1000), JSON.stringify(metadata)).run();
}
export async function handleMobileSms(request, env, user, pathname) {
  if (!user || !user.phone_e164) return json({ error: "Akaunti yenye namba ya simu iliyothibitishwa inahitajika." }, 403);
  const body = await readBody(request);
  if (!body) return json({ error: "Tuma taarifa sahihi za JSON." }, 400);
  const now = Math.floor(Date.now()/1000);
  let phoneHash;
  try { phoneHash = await digestPhone(user.phone_e164, env); }
  catch (_) { return json({ error: "Usanidi wa usalama wa hifadhi fiche haujakamilika." }, 503); }

  if (pathname === "/api/mobile/sms/consent") {
    const purpose = body.purpose;
    const optedIn = body.opted_in === true;
    if (!["service_updates", "marketing"].includes(purpose) || typeof body.opted_in !== "boolean") {
      return json({ error: "Aina ya ruhusa haijatambulika." }, 400);
    }
    if (!(await limit(env.DB, "mobile-consent-user:" + user.id, 10, 3600))) return json({ error: "Umejaribu mara nyingi. Jaribu baadaye." }, 429);
    await env.DB.prepare("INSERT INTO mobile_channel_consents(id,user_id,phone_hash,channel,purpose,consent_status,consent_source,consented_at,revoked_at,created_at) VALUES(?,?,?,'sms',?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), user.id, phoneHash, purpose, optedIn ? "opted_in" : "opted_out",
        "authenticated_account_settings", now, optedIn ? null : now, now).run();
    await audit(env.DB, user.id, optedIn ? "sms_consent_granted" : "sms_consent_revoked", null, { purpose });
    return json({ status: optedIn ? "opted_in" : "opted_out", purpose });
  }

  if (pathname === "/api/mobile/sms/queue") {
    const purpose = body.purpose || "service_updates";
    const message = String(body.message || "").trim();
    const idempotencyKey = String(request.headers.get("Idempotency-Key") || body.idempotency_key || "");
    if (purpose !== "service_updates" || !message || message.length > 320 ||
        !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
      return json({ error: "Ombi ni lazima iwe ujumbe wa huduma, usizidi herufi 320, na iwe na Idempotency-Key halali." }, 400);
    }
    const consent = await env.DB.prepare("SELECT consent_status FROM mobile_channel_consents WHERE user_id=? AND phone_hash=? AND channel='sms' AND purpose='service_updates' ORDER BY consented_at DESC, created_at DESC LIMIT 1")
      .bind(user.id, phoneHash).first();
    if (!consent || consent.consent_status !== "opted_in") return json({ error: "Mteja hajatoa ruhusa ya kupokea SMS za taarifa za huduma." }, 403);
    if (!(await limit(env.DB, "mobile-sms-user:" + user.id, 5, 3600)) ||
        !(await limit(env.DB, "mobile-sms-phone:" + phoneHash, 3, 3600))) {
      return json({ error: "Kikomo cha SMS kimefikiwa. Jaribu baadaye." }, 429);
    }
    const duplicate = await env.DB.prepare("SELECT id,status,user_id FROM mobile_message_jobs WHERE idempotency_key=?").bind(idempotencyKey).first();
    if (duplicate) return duplicate.user_id === user.id
      ? json({ error: "Ombi hili limeshawasilishwa.", job_id: duplicate.id, status: duplicate.status }, 409)
      : json({ error: "Idempotency-Key tayari imetumika." }, 409);
    let phoneCiphertext, messageCiphertext;
    try {
      phoneCiphertext = await encrypt(user.phone_e164, env);
      messageCiphertext = await encrypt(message, env);
    } catch (_) {
      return json({ error: "Hifadhi fiche haijasanidiwa. Hakuna SMS iliyohifadhiwa wala kutumwa." }, 503);
    }
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO mobile_message_jobs(id,user_id,channel,direction,purpose,recipient_phone_ciphertext,recipient_phone_hash,message_ciphertext,template_code,status,idempotency_key,created_at,updated_at) VALUES(?,?,'sms','outbound','service_updates',?,?,?,?,'queued',?,?,?)")
      .bind(id, user.id, phoneCiphertext, phoneHash, messageCiphertext, "SERVICE_UPDATE", idempotencyKey, now, now).run();
    await audit(env.DB, user.id, "sms_job_queued", id, { purpose, provider_delivery: "not_enabled" });
    return json({ job_id: id, status: "queued", delivery: "not_enabled", message: "SMS imehifadhiwa kwenye foleni tu. Haijatumwa; huduma ya mtoa SMS bado haijaunganishwa." }, 202);
  }
  return json({ error: "Njia haipatikani." }, 404);
}
