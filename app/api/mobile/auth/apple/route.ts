import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { signInMobileMemberWithOAuthIdToken } from "@/lib/mobile-oauth-id-token-sign-in";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseMobileAuthClient } from "@/lib/supabase/mobile-server";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;
const WINDOW_MS = 60_000;
const MAX_HITS_PER_IP = 20;
const ipBuckets = new Map<string, { count: number; startAt: number }>();

type AppleAuthRequestV1 = {
  schemaVersion?: number;
  idToken?: unknown;
  nonce?: unknown;
  locale?: unknown;
  displayName?: unknown;
};

function trimString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function readClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.trim();
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function passRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of ipBuckets) {
    if (now - value.startAt > WINDOW_MS * 2) ipBuckets.delete(key);
  }
  const current = ipBuckets.get(ip);
  if (!current || now - current.startAt >= WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, startAt: now });
    return true;
  }
  if (current.count >= MAX_HITS_PER_IP) return false;
  current.count += 1;
  return true;
}

function notConfiguredResponse() {
  return NextResponse.json(
    {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "Apple 登录尚未配置。",
      code: "apple_not_configured",
    },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  if (!flags.memberRegisterEnabled) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "会员登录尚未开放。",
        code: "auth_disabled",
      },
      { status: 503 },
    );
  }

  if (!isSupabaseAuthConfigured()) {
    return notConfiguredResponse();
  }

  const ip = readClientIp(req);
  if (!passRateLimit(ip)) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "请求过于频繁，请稍后再试。",
        code: "rate_limited",
      },
      { status: 429 },
    );
  }

  let body: AppleAuthRequestV1;
  try {
    body = (await req.json()) as AppleAuthRequestV1;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "请求体必须是 JSON。",
        code: "invalid_json",
      },
      { status: 400 },
    );
  }

  const schemaVersion =
    typeof body.schemaVersion === "number" && Number.isFinite(body.schemaVersion)
      ? Math.trunc(body.schemaVersion)
      : SCHEMA_VERSION;
  if (schemaVersion !== SCHEMA_VERSION) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: `不支持的 schemaVersion：${schemaVersion}`,
        code: "unsupported_schema",
      },
      { status: 400 },
    );
  }

  const idToken = trimString(body.idToken);
  const nonce = trimString(body.nonce);
  const locale = trimString(body.locale) || "zh";
  const displayName = trimString(body.displayName);
  if (!idToken || !nonce) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "缺少 Apple idToken 或 nonce。",
        code: "invalid_token",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseMobileAuthClient();
  if (!supabase) return notConfiguredResponse();

  const result = await signInMobileMemberWithOAuthIdToken(supabase, {
    provider: "apple",
    idToken,
    nonce,
    locale,
    displayName,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: result.error,
        code: result.code,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    user: result.user,
    sessionToken: result.sessionToken,
    expiresAt: result.expiresAt,
  });
}
