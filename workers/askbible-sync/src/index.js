// AskBible Sync Worker (Pure JS, ~20KB, Zero Rust/WASM/Supabase bloat, D-44)
// Supports:
// - 6-digit Email OTP via Resend
// - Native Apple & Google ID Token direct public-key JWKS verification (zero browser redirect!)
// - Multi-device sessions, profile update, atomic account deletion
// - Authoritative single-point server-side reading sync merge
// - Anonymous/authenticated feedback & content corrections

import { APPLE_AUDIENCES, GOOGLE_AUDIENCES, verifyOidcIdToken } from "./jwks.js";
import { mergeSyncBlobs } from "./merge.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 45 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const DISPLAY_NAME_MAX_LEN = 24;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Id, X-Platform",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength = 32) {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtpCode() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, "0");
}

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeDisplayName(raw) {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

function isValidDisplayName(raw) {
  const n = normalizeDisplayName(raw);
  const len = [...n].length;
  return len >= 1 && len <= DISPLAY_NAME_MAX_LEN;
}

function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.display_name || row.email.split("@")[0] || row.email,
    locale: row.locale || null,
    isAdmin: Number(row.is_admin || 0) === 1,
    createdAt: new Date(Number(row.created_at || Date.now())).toISOString(),
  };
}

async function ensureUserAndCreateSession(env, { email, preferredName, locale, deviceId, deviceName, platform }) {
  const now = Date.now();
  let userRow = await env.DB.prepare(
    "SELECT id, email, display_name, locale, is_admin, created_at, updated_at FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  const cleanLocale = typeof locale === "string" && locale.trim() ? locale.trim().slice(0, 24) : null;
  const cleanName = isValidDisplayName(preferredName)
    ? normalizeDisplayName(preferredName)
    : email.split("@")[0] || email;

  if (!userRow) {
    const userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, display_name, locale, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
      .bind(userId, email, cleanName, cleanLocale, now, now)
      .run();
    userRow = {
      id: userId,
      email,
      display_name: cleanName,
      locale: cleanLocale,
      is_admin: 0,
      created_at: now,
      updated_at: now,
    };
  } else if (cleanLocale && !userRow.locale) {
    await env.DB.prepare("UPDATE users SET locale = ?, updated_at = ? WHERE id = ?")
      .bind(cleanLocale, now, userRow.id)
      .run();
    userRow.locale = cleanLocale;
  }

  const sessionToken = randomHex(32);
  const tokenHash = await sha256Hex(sessionToken);
  const expiresAtMs = now + SESSION_TTL_MS;
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, email, device_id, device_name, platform, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      tokenHash,
      userRow.id,
      email,
      String(deviceId || "").slice(0, 64),
      String(deviceName || "").slice(0, 64),
      String(platform || "web").slice(0, 24),
      expiresAtMs,
      now,
      now
    )
    .run();

  return {
    sessionToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
    user: formatUser(userRow),
  };
}

async function sendOtpEmail(env, email, code, locale) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV_MODE === "1") return { sent: true, devCode: code };
    throw new Error("邮件服务尚未配置 RESEND_API_KEY");
  }
  const isEn = typeof locale === "string" && locale.toLowerCase().startsWith("en");
  const subject = isEn
    ? `AskBible.me verification code: ${code}`
    : `AskBible.me 登录验证码：${code}`;
  const html = isEn
    ? `<div style="font-family:Georgia,-apple-system,sans-serif;max-width:440px;margin:0 auto;padding:28px;background:#faf6ee;color:#2c241b;border-radius:12px;">
         <h2 style="margin:0 0 12px;font-weight:600;">AskBible.me</h2>
         <p style="color:#5c5042;font-size:14px;line-height:1.6;">Enter this 6-digit code within 10 minutes to sign in:</p>
         <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f0e8d8;border-radius:10px;text-align:center;margin:18px 0;">${code}</div>
         <p style="color:#888;font-size:12px;">If you did not request this code, you may ignore this email.</p>
       </div>`
    : `<div style="font-family:-apple-system,BlinkMacSystemFont,serif;max-width:440px;margin:0 auto;padding:28px;background:#faf6ee;color:#2c241b;border-radius:12px;">
         <h2 style="margin:0 0 12px;font-weight:600;">AskBible.me 登录验证码</h2>
         <p style="color:#5c5042;font-size:14px;line-height:1.6;">请在 10 分钟内输入以下 6 位验证码完成登录与多端读经同步：</p>
         <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f0e8d8;border-radius:10px;text-align:center;margin:18px 0;">${code}</div>
         <p style="color:#888;font-size:12px;">如果不是您本人操作，请忽略此邮件。</p>
       </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || "AskBible.me <hello@cabinetx.app>",
      to: [email],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    throw new Error(`发送验证码失败 (${res.status}): ${await res.text()}`);
  }
  return { sent: true };
}

async function authenticate(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const sess = await env.DB.prepare(
    "SELECT token_hash, user_id, email, expires_at FROM sessions WHERE token_hash = ?"
  )
    .bind(tokenHash)
    .first();
  if (!sess) return null;
  if (Number(sess.expires_at || 0) <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  const userRow = await env.DB.prepare(
    "SELECT id, email, display_name, locale, is_admin, created_at, updated_at FROM users WHERE id = ?"
  )
    .bind(sess.user_id)
    .first();
  if (!userRow) return null;

  const newExpiresAt = now + SESSION_TTL_MS;
  await env.DB.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?")
    .bind(now, newExpiresAt, tokenHash)
    .run();

  return {
    tokenHash,
    expiresAt: new Date(newExpiresAt).toISOString(),
    userRow,
  };
}

function normalizePath(pathname) {
  return pathname.startsWith("/api/sync/") ? pathname.slice("/api/sync".length) : pathname;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (request.method === "GET" && (path === "/healthz.txt" || path === "/health" || path === "/")) {
        return new Response("ok\n", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
        });
      }

      // 1. Send 6-digit Email OTP
      if (request.method === "POST" && path === "/v1/auth/otp/send") {
        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        if (!isValidEmail(email)) {
          return json({ ok: false, code: "invalid_email", error: "请输入有效的邮箱地址。" }, 400);
        }
        const now = Date.now();
        const existing = await env.DB.prepare("SELECT created_at FROM otp_codes WHERE email = ?")
          .bind(email)
          .first();
        if (existing && now - Number(existing.created_at || 0) < OTP_COOLDOWN_MS) {
          const waitSec = Math.ceil((OTP_COOLDOWN_MS - (now - Number(existing.created_at))) / 1000);
          return json({ ok: false, code: "rate_limited", error: `发送过于频繁，请 ${waitSec} 秒后再试。` }, 429);
        }
        const code = generateOtpCode();
        const codeHash = await sha256Hex(`${email}:${code}`);
        await env.DB.prepare(
          `INSERT INTO otp_codes (email, code_hash, expires_at, attempts, created_at)
           VALUES (?, ?, ?, 0, ?)
           ON CONFLICT(email) DO UPDATE SET
             code_hash = excluded.code_hash,
             expires_at = excluded.expires_at,
             attempts = 0,
             created_at = excluded.created_at`
        )
          .bind(email, codeHash, now + OTP_TTL_MS, now)
          .run();

        const delivery = await sendOtpEmail(env, email, code, body.locale);
        return json({
          ok: true,
          email,
          expiresInSec: Math.floor(OTP_TTL_MS / 1000),
          ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
        });
      }

      // 2. Verify 6-digit Email OTP
      if (request.method === "POST" && path === "/v1/auth/otp/verify") {
        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        const code = String(body.code || body.token || "").replace(/\D/g, "");
        if (!isValidEmail(email) || code.length !== 6) {
          return json({ ok: false, code: "invalid_otp", error: "请输入有效的邮箱与 6 位数字验证码。" }, 400);
        }
        const now = Date.now();
        const otpRow = await env.DB.prepare(
          "SELECT code_hash, expires_at, attempts FROM otp_codes WHERE email = ?"
        )
          .bind(email)
          .first();
        if (!otpRow || Number(otpRow.expires_at || 0) < now) {
          return json({ ok: false, code: "otp_expired", error: "验证码已过期，请重新获取。" }, 400);
        }
        if (Number(otpRow.attempts || 0) >= MAX_OTP_ATTEMPTS) {
          await env.DB.prepare("DELETE FROM otp_codes WHERE email = ?").bind(email).run();
          return json({ ok: false, code: "otp_too_many_attempts", error: "尝试次数过多，请重新获取验证码。" }, 400);
        }
        const expectedHash = await sha256Hex(`${email}:${code}`);
        if (expectedHash !== otpRow.code_hash) {
          await env.DB.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?")
            .bind(email)
            .run();
          return json({ ok: false, code: "invalid_otp", error: "验证码不正确，请核对后重试。" }, 401);
        }
        await env.DB.prepare("DELETE FROM otp_codes WHERE email = ?").bind(email).run();

        const session = await ensureUserAndCreateSession(env, {
          email,
          preferredName: body.displayName || body.name || "",
          locale: body.locale,
          deviceId: body.deviceId,
          deviceName: body.deviceName,
          platform: body.platform || "web",
        });
        return json({ ok: true, ...session });
      }

      // 3. Direct Apple / Google Native ID Token Sign-In (Zero Browser OAuth Redirect!)
      if (request.method === "POST" && (path === "/v1/auth/oauth/apple" || path === "/v1/auth/oauth/google")) {
        const body = await request.json().catch(() => ({}));
        const isApple = path.endsWith("/apple");
        const claims = await verifyOidcIdToken({
          idToken: body.idToken,
          jwksUrl: isApple
            ? "https://appleid.apple.com/auth/keys"
            : "https://www.googleapis.com/oauth2/v3/certs",
          issuers: isApple
            ? new Set(["https://appleid.apple.com"])
            : new Set(["https://accounts.google.com", "accounts.google.com"]),
          audiences: isApple ? APPLE_AUDIENCES : GOOGLE_AUDIENCES,
          expectedNonce: typeof body.nonce === "string" ? body.nonce.trim() : "",
        });
        const session = await ensureUserAndCreateSession(env, {
          email: claims.email,
          preferredName: body.displayName || body.name || claims.name || "",
          locale: body.locale,
          deviceId: body.deviceId,
          deviceName: body.deviceName,
          platform: body.platform || (isApple ? "ios" : "android"),
        });
        return json({ ok: true, ...session });
      }

      // 4. Get Current Session
      if (request.method === "GET" && path === "/v1/auth/session") {
        const auth = await authenticate(request, env);
        if (!auth) return json({ ok: false, code: "unauthorized", error: "登录已失效。" }, 401);
        return json({ ok: true, expiresAt: auth.expiresAt, user: formatUser(auth.userRow) });
      }

      // 5. Update Profile Display Name / Locale
      if (request.method === "PATCH" && path === "/v1/auth/profile") {
        const auth = await authenticate(request, env);
        if (!auth) return json({ ok: false, code: "unauthorized", error: "未登录。" }, 401);
        const body = await request.json().catch(() => ({}));
        let nextName = auth.userRow.display_name;
        if (typeof body.name === "string") {
          if (!isValidDisplayName(body.name)) {
            return json({ ok: false, code: "invalid_name", error: "昵称长度需在 1–24 个字符之间。" }, 400);
          }
          nextName = normalizeDisplayName(body.name);
        }
        const nextLocale =
          typeof body.locale === "string" && body.locale.trim()
            ? body.locale.trim().slice(0, 24)
            : auth.userRow.locale;
        await env.DB.prepare("UPDATE users SET display_name = ?, locale = ?, updated_at = ? WHERE id = ?")
          .bind(nextName, nextLocale, Date.now(), auth.userRow.id)
          .run();
        return json({
          ok: true,
          user: formatUser({ ...auth.userRow, display_name: nextName, locale: nextLocale }),
        });
      }

      // 6. Logout Current Device
      if (request.method === "POST" && path === "/v1/auth/logout") {
        const auth = await authenticate(request, env);
        if (auth) {
          await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(auth.tokenHash).run();
        }
        return json({ ok: true });
      }

      // 7. Atomic Account Deletion
      if (request.method === "DELETE" && path === "/v1/auth/account") {
        const auth = await authenticate(request, env);
        if (!auth) return json({ ok: false, code: "unauthorized", error: "未登录。" }, 401);
        if (Number(auth.userRow.is_admin || 0) === 1) {
          return json({ ok: false, code: "admin_protected", error: "管理员账号不支持在此注销。" }, 403);
        }
        const uid = auth.userRow.id;
        await env.DB.batch([
          env.DB.prepare("DELETE FROM reading_sync_docs WHERE user_id = ?").bind(uid),
          env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid),
          env.DB.prepare("DELETE FROM users WHERE id = ?").bind(uid),
        ]);
        return json({ ok: true });
      }

      // 8. Authoritative Single-Point Reading Sync
      if (path === "/v1/sync/reading") {
        const auth = await authenticate(request, env);
        if (!auth) return json({ ok: false, code: "unauthorized", error: "未登录。" }, 401);
        const uid = auth.userRow.id;

        if (request.method === "GET") {
          const row = await env.DB.prepare(
            "SELECT schema_version, revision, blobs_json, updated_at FROM reading_sync_docs WHERE user_id = ?"
          )
            .bind(uid)
            .first();
          if (!row) return json({ ok: true, doc: null });
          return json({
            ok: true,
            doc: {
              schemaVersion: Number(row.schema_version || 1),
              userId: uid,
              revision: row.revision,
              updatedAt: new Date(Number(row.updated_at || Date.now())).toISOString(),
              blobs: JSON.parse(row.blobs_json || "{}"),
            },
          });
        }

        if (request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const incomingBlobs = body && typeof body.blobs === "object" && body.blobs ? body.blobs : {};
          const existing = await env.DB.prepare(
            "SELECT blobs_json FROM reading_sync_docs WHERE user_id = ?"
          )
            .bind(uid)
            .first();
          const baseBlobs =
            body.replace === true || !existing ? {} : JSON.parse(existing.blobs_json || "{}");
          const mergedBlobs = mergeSyncBlobs(baseBlobs, incomingBlobs);
          const now = Date.now();
          const revision = `${now}-${randomHex(4)}`;
          await env.DB.prepare(
            `INSERT INTO reading_sync_docs (user_id, schema_version, revision, blobs_json, updated_at)
             VALUES (?, 1, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
               revision = excluded.revision,
               blobs_json = excluded.blobs_json,
               updated_at = excluded.updated_at`
          )
            .bind(uid, revision, JSON.stringify(mergedBlobs), now)
            .run();

          return json({
            ok: true,
            doc: {
              schemaVersion: 1,
              userId: uid,
              revision,
              updatedAt: new Date(now).toISOString(),
              blobs: mergedBlobs,
            },
          });
        }
      }

      // 9. Feedback & Content Corrections
      if (request.method === "POST" && (path === "/v1/feedback" || path === "/v1/corrections")) {
        const body = await request.json().catch(() => ({}));
        const message = String(body.message || "").trim();
        if (!message || message.length > 8000) {
          return json({ ok: false, error: "内容不能为空且不超过 8000 字。" }, 400);
        }
        const kind = path === "/v1/feedback" ? "feedback" : "correction";
        const id = crypto.randomUUID();
        const now = Date.now();
        const email = typeof body.email === "string" ? body.email.trim().slice(0, 160) : null;
        const locale = typeof body.locale === "string" ? body.locale.trim().slice(0, 24) : null;
        await env.DB.prepare(
          "INSERT INTO feedback_items (id, kind, email, locale, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
          .bind(id, kind, email, locale, JSON.stringify(body), now)
          .run();
        return json({ ok: true, id });
      }

      return json({ ok: false, error: "Not Found" }, 404);
    } catch (err) {
      return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  },
};
