import { NextResponse } from "next/server";
import { verifyAskbibleUserCredentials } from "@/lib/admin-askbible-login";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { issueMobileUserSessionToken } from "@/lib/mobile-auth-session";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;
const WINDOW_MS = 60_000;
const MAX_HITS_PER_IP = 20;
const ipBuckets = new Map<string, { count: number; startAt: number }>();

type LoginRequestV1 = {
  schemaVersion?: number;
  email?: unknown;
  password?: unknown;
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

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return missingSqliteResponse();

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

  const auth = await verifyAskbibleUserCredentials(dbPath, email, password);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "邮箱或密码错误。",
        code: "invalid_credentials",
      },
      { status: 401 },
    );
  }

  const user = { id: auth.userId, email: auth.email, name: auth.name };
  const session = await issueMobileUserSessionToken(user);

  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    user,
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  });
}
