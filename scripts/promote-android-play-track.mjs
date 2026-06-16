#!/usr/bin/env node
/**
 * Promote an already-uploaded Android versionCode to another Play track
 * (same AAB artifact; no re-upload). Used after internal upload so
 * https://play.google.com/apps/testing/me.askbible serves the latest build.
 */
import fs from "node:fs";
import crypto from "node:crypto";

const PACKAGE = process.env.PLAY_PACKAGE_NAME?.trim() || "me.askbible";
const VERSION_CODE = Number(process.argv[2] || process.env.ANDROID_VERSION_CODE || "");
const TARGET_TRACK = (process.argv[3] || process.env.PLAY_PROMOTE_TRACK || "alpha").trim();

function usage() {
  console.error("Usage: node scripts/promote-android-play-track.mjs <versionCode> [track]");
  console.error("Example: node scripts/promote-android-play-track.mjs 34 alpha");
  process.exit(1);
}

if (!Number.isFinite(VERSION_CODE) || VERSION_CODE <= 0) usage();

const keyPath =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim() ||
  new URL("../Aa/askbibleme-6e637caa2ceb.json", import.meta.url).pathname;

if (!fs.existsSync(keyPath)) {
  console.error(`Missing Google Play service account key: ${keyPath}`);
  process.exit(1);
}

const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key.private_key);
  const jwt = `${unsigned}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(body.error || "Failed to obtain Google access token");
  }
  return body.access_token;
}

async function playApi(token, path, init = {}) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok) {
    throw new Error(`Play API ${path} → ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const token = await getAccessToken();
  const edit = await playApi(token, "/edits", { method: "POST", body: JSON.stringify({}) });
  await playApi(token, `/edits/${edit.id}/tracks/${TARGET_TRACK}`, {
    method: "PUT",
    body: JSON.stringify({
      track: TARGET_TRACK,
      releases: [{ status: "completed", versionCodes: [VERSION_CODE] }],
    }),
  });
  await playApi(token, `/edits/${edit.id}:commit`, { method: "POST" });
  console.log(`Promoted versionCode ${VERSION_CODE} to Play track "${TARGET_TRACK}" (${PACKAGE}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
