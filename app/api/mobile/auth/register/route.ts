import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseMobileAuthClient } from "@/lib/supabase/mobile-server";
import {
  supabaseSessionFromAuth,
  toAskbibleAuthUser,
  upsertAskbibleProfile,
} from "@/lib/askbible-supabase-auth";

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

function missingSupabaseResponse() {
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
  const locale = trimString(body.locale).slice(0, 24) || "zh";
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

  if (!isSupabaseAuthConfigured()) {
    return missingSupabaseResponse();
  }

  const supabase = createSupabaseMobileAuthClient();
  if (!supabase) {
    return missingSupabaseResponse();
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name || email } },
  });

  if (signUpError) {
    const msg = signUpError.message || "注册失败";
    const code = /already registered|already exists/i.test(msg) ? "email_already_exists" : "register_failed";
    const status = code === "email_already_exists" ? 409 : 400;
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: msg,
        code,
      },
      { status },
    );
  }

  if (signUpData.session?.user && signUpData.session.access_token) {
    await upsertAskbibleProfile({
      userId: signUpData.session.user.id,
      displayName: name || email,
      locale,
    });
    const user = toAskbibleAuthUser(signUpData.session.user);
    const session = supabaseSessionFromAuth(signUpData.session);
    if (session) {
      return NextResponse.json({
        ok: true,
        schemaVersion: SCHEMA_VERSION,
        user: { id: user.id, email: user.email, name: user.name },
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
        nextAction: "login",
        context: { locale, source },
      });
    }
  } else if (signUpData.user) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && signInData.user && signInData.session) {
      await upsertAskbibleProfile({
        userId: signInData.user.id,
        displayName: name || email,
        locale,
      });

      const user = toAskbibleAuthUser(signInData.user);
      const session = supabaseSessionFromAuth(signInData.session);
      if (session) {
        return NextResponse.json({
          ok: true,
          schemaVersion: SCHEMA_VERSION,
          user: { id: user.id, email: user.email, name: user.name },
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
          nextAction: "login",
          context: { locale, source },
        });
      }
    }

    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "注册成功，请查收确认邮件后再登录。",
        code: "email_confirmation_required",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "注册成功但自动登录失败，请手动登录。",
      code: "login_after_register_failed",
    },
    { status: 500 },
  );
}
