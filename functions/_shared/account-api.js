import { handleMobileSms } from "./mobile-messaging.js";
import { handleCommunicationContacts } from "./communication-contacts.js";
const PASSWORD_ITERATIONS = 310000;
const CODE_HASH_ITERATIONS = 120000;
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const CODE_SECONDS = 10 * 60;
const MAX_CODE_ATTEMPTS = 5;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64url(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}

function randomToken(size = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function derivePassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: decodeBase64url(salt), iterations },
    key, 256
  );
  return hex(bits);
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

function validOrigin(request) {
  const origin = request.headers.get("Origin");
  return !!origin && origin === new URL(request.url).origin;
}

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    throw new Error("JSON_REQUIRED");
  }
  const raw = await request.text();
  if (raw.length > 8192) throw new Error("BODY_TOO_LARGE");
  try { return JSON.parse(raw); } catch (_) { throw new Error("INVALID_JSON"); }
}

async function rateLimit(db, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(
    `INSERT INTO rate_limits(rate_key, window_start, request_count)
     VALUES (?, ?, 1)
     ON CONFLICT(rate_key) DO UPDATE SET
       request_count = CASE WHEN window_start <= ? THEN 1 ELSE request_count + 1 END,
       window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END
     RETURNING request_count`
  ).bind(key, now, now - windowSeconds, now - windowSeconds).first();
  return !!row && row.request_count <= limit;
}

async function audit(db, userId, eventType, detail = {}) {
  await db.prepare(
    "INSERT INTO security_events(id,user_id,event_type,created_at,detail_json) VALUES(?,?,?,?,?)"
  ).bind(crypto.randomUUID(), userId || null, eventType, Math.floor(Date.now() / 1000), JSON.stringify(detail)).run();
}

export function normalizeSenderAddress(value) {
  const configuredFrom = String(value || "onboarding@resend.dev").trim();
  const angleAddress = configuredFrom.match(/<\s*([^<>]+)\s*>/);
  const senderAddress = (angleAddress ? angleAddress[1] : configuredFrom).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(senderAddress)) {
    throw new Error("RESEND_FROM_EMAIL must contain a valid sender email address");
  }
  return senderAddress;
}

async function sendVerification(env, type, recipient, code) {
  if (type === "email" && env.RESEND_API_KEY) {
    const senderAddress = normalizeSenderAddress(env.RESEND_FROM_EMAIL);
    // Always present the platform's own verified brand name to the recipient.
    const from = `FICSDavid <${senderAddress}>`;
    const textBody = `Your FICSDavid verification code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`;
    const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>FICSDavid account verification</h2><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: "Your FICSDavid verification code",
        text: textBody,
        html: htmlBody
      })
    });
    return response.ok;
  }

  const url = type === "email" ? env.EMAIL_DELIVERY_URL : env.SMS_DELIVERY_URL;
  const token = type === "email" ? env.EMAIL_DELIVERY_TOKEN : env.SMS_DELIVERY_TOKEN;
  if (!url || !token || !url.startsWith("https://")) return false;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient, code, purpose: "FICSDavid account verification", expires_in_seconds: CODE_SECONDS })
  });
  return response.ok;
}

function cookie(token, maxAge) {
  return `__Host-ficsd_session=${token}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const entry = header.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return entry ? entry.slice(name.length + 1) : null;
}

async function currentUser(request, env) {
  const token = getCookie(request, "__Host-ficsd_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.id,u.email,u.phone_e164,u.display_name,u.created_at
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`
  ).bind(tokenHash, now).first();
  if (row) {
    await env.DB.prepare("UPDATE sessions SET last_seen_at=? WHERE token_hash=?")
      .bind(now, tokenHash).run();
  }
  return row || null;
}

async function requestCode(request, env) {
  let stage = "parse_request";
  try {
    const body = await readJson(request);
    const type = body.contact_type === "email" ? "email" : body.contact_type === "phone" ? "phone" : null;
    const contact = normalizeContact(type, body.contact);
    if (!type || !contact) return json({ error: "Enter a valid email address or international phone number." }, 400);

    stage = "prepare_rate_limit";
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const contactKey = await sha256("contact:" + contact);
    const ipKey = await sha256("ip:" + ip);
    if (!(await rateLimit(env.DB, "code-contact:" + contactKey, 3, 3600)) ||
        !(await rateLimit(env.DB, "code-ip:" + ipKey, 10, 3600))) {
      return json({ error: "Too many requests. Try again later." }, 429);
    }

    stage = "check_existing_account";
    const existing = type === "email"
      ? await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(contact).first()
      : await env.DB.prepare("SELECT id FROM users WHERE phone_e164=?").bind(contact).first();
    if (existing) return json({ message: "If this contact can be registered, a verification code will be sent." }, 202);

    stage = "generate_verification_code";
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = base64url(saltBytes);
    const codeHash = await derivePassword(code, salt, CODE_HASH_ITERATIONS);
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    stage = "save_verification_code";
    await env.DB.prepare(
      "INSERT INTO verification_codes(id,contact_type,contact_value,purpose,code_salt,code_hash,expires_at,created_at) VALUES(?,?,?,'register',?,?,?,?)"
    ).bind(id, type, contact, salt, codeHash, now + CODE_SECONDS, now).run();

    stage = "send_verification";
    let delivered = false;
    try {
      delivered = await sendVerification(env, type, contact, code);
    } catch (deliveryError) {
      console.error("FICSDavid verification delivery failure", {
        error_name: deliveryError && deliveryError.name ? String(deliveryError.name) : "Error",
        error_message: deliveryError && deliveryError.message ? String(deliveryError.message).slice(0, 200) : "Unknown delivery error"
      });
    }
    if (!delivered) {
      stage = "cleanup_unsent_verification";
      await env.DB.prepare("DELETE FROM verification_codes WHERE id=?").bind(id).run();
      return json({ error: "Verification delivery is not configured. No account was created." }, 503);
    }
    return json({ message: "If this contact can be registered, a verification code has been sent.", verification_id: id }, 202);
  } catch (error) {
    console.error("FICSDavid request-code stage failure", {
      stage,
      error_name: error && error.name ? String(error.name) : "Error",
      error_message: error && error.message ? String(error.message).slice(0, 200) : "Unknown server error"
    });
    throw error;
  }
}
async function verifyCode(request, env) {
  const body = await readJson(request);
  const id = String(body.verification_id || "");
  const code = String(body.code || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{6}$/.test(code)) {
    return json({ error: "Invalid verification details." }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256("verify-ip:" + ip);
  const idHash = await sha256("verify-id:" + id);
  if (!(await rateLimit(env.DB, "verify-ip:" + ipHash, 15, 600)) ||
      !(await rateLimit(env.DB, "verify-id:" + idHash, 5, 600))) {
    return json({ error: "Too many verification attempts. Request a new code later." }, 429);
  }
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT id,code_salt,code_hash,attempts,expires_at,verified_at,consumed_at FROM verification_codes WHERE id=? AND purpose='register'"
  ).bind(id).first();
  if (!row || row.consumed_at || row.expires_at <= now || row.attempts >= MAX_CODE_ATTEMPTS) {
    return json({ error: "Code is invalid or expired. Request a new code." }, 400);
  }
  const hash = await derivePassword(code, row.code_salt, CODE_HASH_ITERATIONS);
  if (!constantTimeEqual(hash, row.code_hash)) {
    await env.DB.prepare("UPDATE verification_codes SET attempts=attempts+1 WHERE id=?").bind(id).run();
    return json({ error: "Incorrect code." }, 400);
  }
  await env.DB.prepare("UPDATE verification_codes SET verified_at=? WHERE id=? AND consumed_at IS NULL")
    .bind(now, id).run();
  return json({ message: "Contact verified. You may now create your account." });
}

async function register(request, env) {
  const body = await readJson(request);
  const id = String(body.verification_id || "");
  const displayName = String(body.display_name || "").trim();
  const password = String(body.password || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || displayName.length < 2 || displayName.length > 80 ||
      password.length < 12 || password.length > 128) {
    return json({ error: "Check your name and password. Use at least 12 characters." }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256("register-ip:" + ip);
  const idHash = await sha256("register-id:" + id);
  if (!(await rateLimit(env.DB, "register-ip:" + ipHash, 10, 900)) ||
      !(await rateLimit(env.DB, "register-id:" + idHash, 3, 900))) {
    return json({ error: "Too many registration attempts. Try again later." }, 429);
  }

  const now = Math.floor(Date.now() / 1000);
  const verified = await env.DB.prepare(
    "SELECT * FROM verification_codes WHERE id=? AND purpose='register' AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at>?"
  ).bind(id, now).first();
  if (!verified) return json({ error: "Verify your contact again before registering." }, 400);

  const salt = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await derivePassword(password, salt);
  const userId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users(id,email,phone_e164,display_name,password_salt,password_hash,password_iterations,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)"
      ).bind(userId, verified.contact_type === "email" ? verified.contact_value : null,
        verified.contact_type === "phone" ? verified.contact_value : null,
        displayName, salt, passwordHash, PASSWORD_ITERATIONS, now, now),
      env.DB.prepare("UPDATE verification_codes SET consumed_at=? WHERE id=? AND consumed_at IS NULL")
        .bind(now, id)
    ]);
  } catch (_) {
    return json({ error: "This contact may already be registered. Try signing in." }, 409);
  }

  await audit(env.DB, userId, "account_created");
  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  const sessionId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)"
  ).bind(sessionId, userId, tokenHash, now, now + SESSION_SECONDS, now).run();

  return json({ user: { id: userId, display_name: displayName } }, 201, {
    "Set-Cookie": cookie(rawToken, SESSION_SECONDS)
  });
}

async function login(request, env) {
  const body = await readJson(request);
  const type = body.contact_type === "email" ? "email" : body.contact_type === "phone" ? "phone" : null;
  const contact = normalizeContact(type, body.contact);
  const password = String(body.password || "");
  if (!type || !contact || password.length > 128 || !password) {
    return json({ error: "Invalid contact or password." }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const contactHash = await sha256("login:" + contact);
  const ipHash = await sha256("login-ip:" + ip);
  if (!(await rateLimit(env.DB, "login-contact:" + contactHash, 8, 900)) ||
      !(await rateLimit(env.DB, "login-ip:" + ipHash, 20, 900))) {
    return json({ error: "Too many sign-in attempts. Try again later." }, 429);
  }

  const user = type === "email"
    ? await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(contact).first()
    : await env.DB.prepare("SELECT * FROM users WHERE phone_e164=?").bind(contact).first();
  const salt = user ? user.password_salt : "MDAwMDAwMDAwMDAwMDAwMDAwMDA=";
  const expected = user ? user.password_hash : "0".repeat(64);
  const actual = await derivePassword(password, salt, user ? user.password_iterations : PASSWORD_ITERATIONS);
  if (!user || user.status !== "active" || !constantTimeEqual(actual, expected)) {
    await audit(env.DB, null, "login_failed");
    return json({ error: "Invalid contact or password." }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  await env.DB.prepare(
    "INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)"
  ).bind(crypto.randomUUID(), user.id, tokenHash, now, now + SESSION_SECONDS, now).run();
  await env.DB.prepare("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?")
    .bind(now, now, user.id).run();
  await audit(env.DB, user.id, "login_success");
  return json({ user: { id: user.id, display_name: user.display_name } }, 200, {
    "Set-Cookie": cookie(rawToken, SESSION_SECONDS)
  });
}

async function me(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ user: null }, 200);
  return json({ user: { id: user.id, email: user.email, phone: user.phone_e164, display_name: user.display_name } });
}

async function logout(request, env) {
  const token = getCookie(request, "__Host-ficsd_session");
  if (token) {
    await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL")
      .bind(Math.floor(Date.now() / 1000), await sha256(token)).run();
  }
  return json({ message: "Signed out." }, 200, {
    "Set-Cookie": cookie("", 0)
  });
}

async function createSupportTicket(request, env) {
  if (!validOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256("support-ticket-ip:" + ip);
  if (!(await rateLimit(env.DB, "support-ticket:" + ipHash, 5, 3600))) {
    return json({ error: "Too many reports. Please try again later." }, 429);
  }
  const body = await readJson(request);
  const category = String(body.category || "").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const contact = String(body.contact || "").trim();
  const allowed = ["account", "search", "communication", "payments", "technical", "other"];
  if (!allowed.includes(category) || subject.length < 4 || subject.length > 120 ||
      message.length < 10 || message.length > 3000 || contact.length > 254) {
    return json({ error: "Please check the category, subject, message and contact details." }, 400);
  }
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return json({ error: "Enter a valid email address or leave the contact field empty." }, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const ticketCode = "FICS-" + randomToken(6).toUpperCase();
  await env.DB.prepare(
    "INSERT INTO support_tickets(id,ticket_code,category,subject,message,contact,created_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(id, ticketCode, category, subject, message, contact || null, now).run();
  return json({ success: true, ticket_code: ticketCode }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      try {
        // Resolve every table required by the account foundation without scanning user data.
        await env.DB.prepare("SELECT 1 FROM users, verification_codes, sessions, rate_limits, security_events LIMIT 0").first();
        const emailConfigured = !!(env.RESEND_API_KEY ||
          (env.EMAIL_DELIVERY_URL && env.EMAIL_DELIVERY_TOKEN && env.EMAIL_DELIVERY_URL.startsWith("https://")));
        const phoneConfigured = !!(env.SMS_DELIVERY_URL && env.SMS_DELIVERY_TOKEN &&
          env.SMS_DELIVERY_URL.startsWith("https://"));
        return json({
          status: "ok",
          account_api: "available",
          database_schema: "ready",
          registration: { email: emailConfigured, phone: phoneConfigured }
        });
      } catch (_) {
        return json({ status: "not_ready", account_api: "database_or_schema_unavailable" }, 503);
      }
    }

    if (url.pathname === "/api/communication/contacts" || url.pathname.startsWith("/api/communication/contacts/")) {
      if (!["GET", "POST", "DELETE"].includes(request.method)) {
        return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
      }
      if (request.method !== "GET" && !validOrigin(request)) {
        return json({ error: "Request origin rejected." }, 403);
      }
      try {
        const user = await currentUser(request, env);
        return await handleCommunicationContacts(request, env, user, url.pathname);
      } catch (_) {
        return json({ error: "Huduma ya contacts haikuweza kukamilisha ombi." }, 500);
      }
    }

    if (url.pathname.startsWith("/api/mobile/sms/")) {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
      if (!validOrigin(request)) return json({ error: "Request origin rejected." }, 403);
      try {
        const user = await currentUser(request, env);
        return await handleMobileSms(request, env, user, url.pathname);
      } catch (_) {
        return json({ error: "Huduma ya SMS haikuweza kukamilisha ombi." }, 500);
      }
    }

    if (url.pathname === "/api/support/tickets" && request.method === "POST") {
      try { return await createSupportTicket(request, env); }
      catch (error) {
        if (error && error.message === "JSON_REQUIRED") return json({ error: "Send JSON content." }, 415);
        if (error && error.message === "BODY_TOO_LARGE") return json({ error: "Request too large." }, 413);
        if (error && error.message === "INVALID_JSON") return json({ error: "Invalid JSON." }, 400);
        return json({ error: "The report could not be saved. Please try again later." }, 500);
      }
    }
    if (url.pathname === "/api/support/tickets") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    if (!url.pathname.startsWith("/api/auth/")) return json({ error: "Not found." }, 404);
    if (request.method !== "POST" && !(request.method === "GET" && url.pathname === "/api/auth/me")) {
      return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST" });
    }
    if (request.method === "POST" && !validOrigin(request)) {
      return json({ error: "Request origin rejected." }, 403);
    }

    try {
      if (request.method === "POST" && url.pathname === "/api/auth/request-code") return await requestCode(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/verify-code") return await verifyCode(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/register") return await register(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/login") return await login(request, env);
      if (request.method === "GET" && url.pathname === "/api/auth/me") return await me(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/logout") return await logout(request, env);
      return json({ error: "Not found." }, 404);
    } catch (error) {
      if (error && error.message === "JSON_REQUIRED") return json({ error: "Send JSON content." }, 415);
      if (error && error.message === "BODY_TOO_LARGE") return json({ error: "Request too large." }, 413);
      if (error && error.message === "INVALID_JSON") return json({ error: "Invalid JSON." }, 400);
      // Log only server-side diagnostic metadata; never log request bodies, codes, passwords, or contacts.
      console.error("FICSDavid auth API failure", {
        path: url.pathname,
        error_name: error && error.name ? String(error.name) : "Error",
        error_message: error && error.message ? String(error.message).slice(0, 240) : "Unknown server error"
      });
      return json({ error: "The request could not be completed." }, 500);
    }
  }
};
