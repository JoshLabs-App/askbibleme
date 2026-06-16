import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { signInMemberWithPasswordMobile } from "@/lib/member-auth-backend";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;
const WINDOW_MS = 60_000;
const MAX_HITS_PER_IP = 20;
const ipBuckets = new Map<string, { count: number; startAt: number }>();

type LoginRequestV1 = {
  schemaVersion?: number;
  email?: unknown;
  password?: unknown;
  locale?: unknown;
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

function missingSqliteResponse() {
  return NextResponse.json(
    {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "登录服务尚未配置，请稍后再试。",
      code: "auth_not_configured",
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

  let body: LoginRequestV1;
  try {
    body = (await req.json()) as LoginRequestV1;
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

  const email = trimString(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const locale = trimString(body.locale).slice(0, 24);
  if (!email || !password) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "缺少邮箱或密码。",
        code: "invalid_credentials",
      },
      { status: 400 },
    );
  }

  const auth = await signInMemberWithPasswordMobile(email, password, locale || undefined);
  if (!auth.ok) {
    if (auth.code === "auth_not_configured") return missingSqliteResponse();
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: auth.error,
        code: auth.code,
      },
      { status: auth.status },
    );
  }

  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    user: auth.user,
    sessionToken: auth.sessionToken,
    expiresAt: auth.expiresAt,
  });
}
