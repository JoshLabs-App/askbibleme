import { NextResponse } from "next/server";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { registerAskbibleSqliteUser } from "@/lib/askbible-user-sqlite";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;
const WINDOW_MS = 60_000;
const MAX_HITS_PER_IP = 12;
const ipBuckets = new Map<string, { count: number; startAt: number }>();

type RegisterRequestV1 = {
  schemaVersion?: number;
  email?: unknown;
  password?: unknown;
  name?: unknown;
  locale?: unknown;
  source?: unknown;
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

function validEmail(email: string): boolean {
  if (!email || email.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function missingSqliteResponse() {
  return NextResponse.json(
    {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "注册服务尚未配置，请稍后再试。",
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
        error: "会员注册尚未开放。",
        code: "register_disabled",
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

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return missingSqliteResponse();

  let body: RegisterRequestV1;
  try {
    body = (await req.json()) as RegisterRequestV1;
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
  const name = trimString(body.name);
  const locale = trimString(body.locale).slice(0, 24);
  const source = trimString(body.source).slice(0, 60);

  if (!validEmail(email)) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "邮箱格式不正确。",
        code: "invalid_email",
      },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "密码至少需要 8 位。",
        code: "password_too_short",
      },
      { status: 400 },
    );
  }

  const created = await registerAskbibleSqliteUser({ dbPath, email, password, name });
  if (!created.ok) {
    const code = created.status === 409 ? "email_already_exists" : "register_failed";
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: created.error,
        code,
      },
      { status: created.status },
    );
  }

  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    user: created.user,
    // 预留：后续加邮件验证 / 首登引导可通过 nextAction 扩展
    nextAction: "login",
    context: { locale, source },
  });
}
