// FICSDavid Communication Centre contact API.
// Contact values are encrypted at rest and never returned from the database in plaintext.
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function b64url(bytes) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}

function normalizeContact(type, value) {
  const input = String(value || "").trim();
  if (type === "email") {
    const email = input.toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  }
  if (type === "phone") {
    let phone = input.replace(/[\s().-]/g, "");
    if (/^0\d{9}$/.test(phone)) phone = "+255" + phone.slice(1);
    if (/^255\d{9}$/.test(phone)) phone = "+" + phone;
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
    return phone;
  }
  return null;
}

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return null;
  }
  const raw = await request.text();
  if (raw.length > 8192) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function encryptionKey(env) {
  if (!env.MOBILE_DATA_ENCRYPTION_KEY) throw new Error("CONTACT_ENCRYPTION_NOT_CONFIGURED");
  const raw = fromB64url(env.MOBILE_DATA_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error("CONTACT_ENCRYPTION_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function hashContact(type, value, env) {
  if (!env.MOBILE_PHONE_HASH_KEY) throw new Error("CONTACT_HASH_NOT_CONFIGURED");
  const raw = fromB64url(env.MOBILE_PHONE_HASH_KEY);
  if (raw.length !== 32) throw new Error("CONTACT_HASH_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("ficsd-contact-" + type + ":" + value)
  );
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptContact(value, userId, type, env) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode("ficsd-contact:v1:" + userId + ":" + type);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    new TextEncoder().encode(value)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return b64url(combined);
}

async function decryptContact(ciphertext, userId, type, env) {
  if (!ciphertext) return null;
  const key = await encryptionKey(env);
  const combined = fromB64url(ciphertext);
  if (combined.length < 29) throw new Error("CONTACT_CIPHERTEXT_INVALID");
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const additionalData = new TextEncoder().encode("ficsd-contact:v1:" + userId + ":" + type);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    data
  );
  return new TextDecoder().decode(plaintext);
}

async function rateLimit(db, key, maximum, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(
    `INSERT INTO rate_limits(rate_key,window_start,request_count) VALUES(?,?,1)
     ON CONFLICT(rate_key) DO UPDATE SET
       request_count=CASE WHEN window_start<=? THEN 1 ELSE request_count+1 END,
       window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END
     RETURNING request_count`
  ).bind(key, now, now - windowSeconds, now - windowSeconds).first();
  return !!row && row.request_count <= maximum;
}

async function audit(db, userId, eventType, referenceId) {
  await db.prepare(
    "INSERT INTO service_audit_events(id,user_id,service_name,event_type,reference_id,created_at,metadata_json) VALUES(?,?,'communication',?,?,?,'{}')"
  ).bind(crypto.randomUUID(), userId, eventType, referenceId || null, Math.floor(Date.now() / 1000)).run();
}

async function listContacts(env, user) {
  const rows = await env.DB.prepare(
    `SELECT id,display_label,contact_type,phone_ciphertext,email_ciphertext,contact_user_id,created_at
     FROM communication_contacts WHERE owner_user_id=?
     ORDER BY display_label COLLATE NOCASE ASC, created_at DESC LIMIT 500`
  ).bind(user.id).all();

  const contacts = [];
  for (const row of rows.results || []) {
    const type = row.contact_type;
    const ciphertext = type === "phone" ? row.phone_ciphertext : type === "email" ? row.email_ciphertext : null;
    const value = ciphertext ? await decryptContact(ciphertext, user.id, type, env) : null;
    contacts.push({
      id: row.id,
      display_label: row.display_label,
      contact_type: type || "legacy",
      contact_value: value,
      is_ficsdavid_user: !!row.contact_user_id,
      created_at: row.created_at
    });
  }
  return json({ contacts });
}

async function addContact(request, env, user) {
  const body = await readJson(request);
  if (!body) return json({ error: "Tuma taarifa sahihi za JSON." }, 400);

  const type = body.contact_type === "phone" ? "phone" : body.contact_type === "email" ? "email" : null;
  const value = normalizeContact(type, body.contact_value);
  const label = String(body.display_label || "").trim();
  if (!type || !value || label.length < 1 || label.length > 80) {
    return json({ error: "Weka jina la contact na namba ya simu au barua pepe sahihi." }, 400);
  }
  if ((type === "phone" && value === user.phone_e164) || (type === "email" && value === user.email)) {
    return json({ error: "Huwezi kujiongeza mwenyewe kwenye contacts." }, 400);
  }
  if (!(await rateLimit(env.DB, "communication-contacts:" + user.id, 30, 3600))) {
    return json({ error: "Umefikia kikomo cha kuongeza contacts. Jaribu baadaye." }, 429);
  }

  let contactUser = null;
  if (type === "phone") {
    contactUser = await env.DB.prepare("SELECT id FROM users WHERE phone_e164=? AND status='active'").bind(value).first();
  } else {
    contactUser = await env.DB.prepare("SELECT id FROM users WHERE email=? AND status='active'").bind(value).first();
  }

  if (contactUser && contactUser.id === user.id) {
    return json({ error: "Huwezi kujiongeza mwenyewe kwenye contacts." }, 400);
  }
  if (contactUser) {
    const duplicatePerson = await env.DB.prepare(
      "SELECT id FROM communication_contacts WHERE owner_user_id=? AND contact_user_id=? LIMIT 1"
    ).bind(user.id, contactUser.id).first();
    if (duplicatePerson) return json({ error: "Mtumiaji huyu tayari yupo kwenye contacts zako." }, 409);
    const blocked = await env.DB.prepare(
      "SELECT 1 AS blocked FROM communication_blocks WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?) LIMIT 1"
    ).bind(user.id, contactUser.id, contactUser.id, user.id).first();
    if (blocked) return json({ error: "Contact huyu hawezi kuongezwa kwa sababu ya mipangilio ya kuzuia mawasiliano." }, 403);
  }

  let valueHash, valueCiphertext;
  try {
    valueHash = await hashContact(type, value, env);
    valueCiphertext = await encryptContact(value, user.id, type, env);
  } catch (_) {
    return json({ error: "Usanidi wa usalama wa contacts haujakamilika. Hakuna taarifa iliyohifadhiwa." }, 503);
  }

  const hashColumn = type === "phone" ? "phone_hash" : "email_hash";
  const existing = await env.DB.prepare(
    "SELECT id FROM communication_contacts WHERE owner_user_id=? AND " + hashColumn + "=? LIMIT 1"
  ).bind(user.id, valueHash).first();
  if (existing) return json({ error: "Contact hii tayari ipo kwenye orodha yako." }, 409);

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const phoneHash = type === "phone" ? valueHash : null;
  const emailHash = type === "email" ? valueHash : null;
  const phoneCiphertext = type === "phone" ? valueCiphertext : null;
  const emailCiphertext = type === "email" ? valueCiphertext : null;

  try {
    await env.DB.prepare(
      "INSERT INTO communication_contacts(id,owner_user_id,contact_user_id,display_label,phone_hash,email_hash,created_at,updated_at,contact_type,phone_ciphertext,email_ciphertext) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, user.id, contactUser ? contactUser.id : null, label, phoneHash, emailHash, now, now, type, phoneCiphertext, emailCiphertext).run();
    await audit(env.DB, user.id, "contact_added", id);
    return json({
      contact: {
        id,
        display_label: label,
        contact_type: type,
        contact_value: value,
        is_ficsdavid_user: !!contactUser,
        created_at: now
      }
    }, 201);
  } catch (_) {
    return json({ error: "Contact haikuweza kuhifadhiwa. Jaribu tena." }, 500);
  }
}

async function deleteContact(env, user, pathname) {
  const prefix = "/api/communication/contacts/";
  const id = pathname.slice(prefix.length);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Contact haijatambulika." }, 400);
  const result = await env.DB.prepare(
    "DELETE FROM communication_contacts WHERE id=? AND owner_user_id=?"
  ).bind(id, user.id).run();
  if (!result.meta || result.meta.changes !== 1) return json({ error: "Contact haipo kwenye orodha yako." }, 404);
  await audit(env.DB, user.id, "contact_deleted", id);
  return json({ success: true, deleted_id: id });
}

export async function handleCommunicationContacts(request, env, user, pathname) {
  if (!user) return json({ error: "Ingia kwenye akaunti yako ya FICSDavid kwanza." }, 401);

  if (request.method === "GET" && pathname === "/api/communication/contacts") {
    try {
      if (!(await rateLimit(env.DB, "communication-contact-list:" + user.id, 120, 3600))) {
        return json({ error: "Umejaribu mara nyingi. Jaribu baadaye." }, 429);
      }
      return await listContacts(env, user);
    } catch (_) {
      return json({ error: "Orodha ya contacts haikuweza kufunguliwa. Hakikisha funguo za usalama na migration vimewekwa." }, 503);
    }
  }

  if (request.method === "POST" && pathname === "/api/communication/contacts") {
    try { return await addContact(request, env, user); }
    catch (_) { return json({ error: "Contact haikuweza kuhifadhiwa. Hakikisha migration ya contacts imetumika." }, 503); }
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/communication/contacts/")) {
    try { return await deleteContact(env, user, pathname); }
    catch (_) { return json({ error: "Contact haikuweza kufutwa. Jaribu tena." }, 503); }
  }

  return json({ error: "Njia haipatikani." }, 404);
}
