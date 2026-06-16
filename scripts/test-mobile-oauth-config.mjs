#!/usr/bin/env node
/**
 * 校验移动端 OAuth 配置（Supabase Google OAuth URL + 本地/线上 Apple API 可达性）。
 * 用法：node scripts/test-mobile-oauth-config.mjs
 */
import { createClient } from "@supabase/supabase-js";

const LOCAL = (process.env.ASKBIBLE_BASE_URL || "http://192.168.1.20:3450").replace(/\/$/, "");
const PROD = "https://askbible.me";
const SCHEMA = 1;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function pass(name, detail = "") {
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function postApple(base) {
  const res = await fetch(`${base}/api/mobile/auth/apple`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ schemaVersion: SCHEMA, idToken: "invalid", nonce: "invalid", locale: "zh" }),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  console.log("AskBible mobile OAuth config check\n");

  if (!supabaseUrl || !supabaseAnon) {
    fail("Supabase env", "missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY");
  } else {
    pass("Supabase env", supabaseUrl);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "askbible://auth/callback",
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data?.url) {
    fail("Supabase Google OAuth URL", error?.message || "no url");
  } else {
    pass("Supabase Google OAuth URL", new URL(data.url).hostname);
  }

  for (const [label, base] of [
    ["local Apple API", LOCAL],
    ["production Apple API", PROD],
  ]) {
    try {
      const { status, data: body } = await postApple(base);
      if (status === 503 && body.code === "auth_disabled") {
        fail(label, "memberRegisterEnabled=false");
      } else if (status === 503 && body.code === "apple_not_configured") {
        fail(label, "apple_not_configured");
      } else if (status === 401 || status === 400) {
        pass(label, `${status} ${body.code || "reachable"}`);
      } else {
        pass(label, `HTTP ${status}`);
      }
    } catch (err) {
      fail(label, err instanceof Error ? err.message : String(err));
    }
  }

  if (process.exitCode) {
    console.log("\nSome checks failed.");
    process.exit(process.exitCode);
  }
  console.log("\nOAuth config OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
