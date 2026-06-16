#!/usr/bin/env node
/**
 * App 会员登录/注册链路集成测试（与 apps/askbible-mobile/src/api/memberAuth.ts 同协议）。
 * 用法：node scripts/test-mobile-auth.mjs [baseUrl]
 */
const BASE = (process.argv[2] || process.env.ASKBIBLE_BASE_URL || "http://localhost:3450").replace(/\/$/, "");
const SCHEMA_VERSION = 1;
const PASS = "AppTestPass1!";

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json", ...headers } });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  console.log(`AskBible mobile auth integration test → ${BASE}\n`);

  const { res: manifestRes, data: manifest } = await get("/api/mobile/content/manifest");
  if (!manifestRes.ok || manifest?.serverCapabilities?.memberRegisterEnabled !== true) {
    fail("manifest.memberRegisterEnabled", JSON.stringify(manifest?.serverCapabilities ?? manifest));
  } else {
    pass("manifest.memberRegisterEnabled", "true");
  }

  const email = `app.test.${Date.now()}@test.local`;
  const { res: regRes, data: reg } = await post("/api/mobile/auth/register", {
    schemaVersion: SCHEMA_VERSION,
    email,
    password: PASS,
    name: "App Test",
    locale: "zh",
    source: "test-mobile-auth",
  });

  if (!regRes.ok || reg.ok !== true || !reg.sessionToken) {
    fail("register", `${regRes.status} ${reg.error || reg.code || JSON.stringify(reg)}`);
  } else {
    pass("register", email);
  }

  const { res: sessionRes, data: session } = await get("/api/mobile/auth/session", {
    Authorization: `Bearer ${reg.sessionToken}`,
  });
  if (!sessionRes.ok || session.user?.email !== email) {
    fail("session after register", JSON.stringify(session));
  } else {
    pass("session after register", session.user.name);
  }

  const { res: loginRes, data: login } = await post("/api/mobile/auth/login", {
    schemaVersion: SCHEMA_VERSION,
    email,
    password: PASS,
  });
  if (!loginRes.ok || login.ok !== true || !login.sessionToken) {
    fail("login", `${loginRes.status} ${login.error || login.code || JSON.stringify(login)}`);
  } else {
    pass("login", login.user?.email);
  }

  const { res: session2Res, data: session2 } = await get("/api/mobile/auth/session", {
    Authorization: `Bearer ${login.sessionToken}`,
  });
  if (!session2Res.ok || session2.user?.id !== login.user?.id) {
    fail("session after login", JSON.stringify(session2));
  } else {
    pass("session after login");
  }

  const bad = await post("/api/mobile/auth/login", {
    schemaVersion: SCHEMA_VERSION,
    email,
    password: "wrong-password",
  });
  if (bad.res.status !== 401 || bad.data.ok !== false) {
    fail("wrong password rejected", `${bad.res.status}`);
  } else {
    pass("wrong password rejected");
  }

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
