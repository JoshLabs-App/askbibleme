/**
 * 通过旧站 HTTP 接口登录：由旧站校验账号密码，AskBible 只信任成功响应并签发本站 cookie（不读 auth.sqlite）。
 *
 * 环境变量见 `.env.example`。请求体固定为 JSON：
 * `{ "email": string, "password": string, "purpose": "user" | "admin" }`
 * （旧站可忽略 `purpose`；若与用户共用同一 URL，管理端依赖响应里的管理员标记。）
 */

import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";

const LEGACY_FETCH_MS = 12_000;

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? "";
}

/** 前台 `/login`：优先于 sqlite */
export function getLegacyUserLoginUrl(): string | null {
  const u = trimEnv("ASKBIBLE_LEGACY_USER_LOGIN_URL");
  if (u) return u;
  return trimEnv("ASKBIBLE_LEGACY_LOGIN_URL") || null;
}

/** 后台 `/admin/login`：仅 `ASKBIBLE_LEGACY_ADMIN_LOGIN_URL` 或统一 `ASKBIBLE_LEGACY_LOGIN_URL`（勿自动等同 USER URL，以便前台远程 + 后台 sqlite 并存） */
export function getLegacyAdminLoginUrl(): string | null {
  const a = trimEnv("ASKBIBLE_LEGACY_ADMIN_LOGIN_URL");
  if (a) return a;
  return trimEnv("ASKBIBLE_LEGACY_LOGIN_URL") || null;
}

export function isLegacyRemoteUserAuthConfigured(): boolean {
  return Boolean(getLegacyUserLoginUrl());
}

export function isLegacyRemoteAdminAuthConfigured(): boolean {
  return Boolean(getLegacyAdminLoginUrl());
}

function legacyHeaders(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const bearer = trimEnv("ASKBIBLE_LEGACY_LOGIN_BEARER");
  if (bearer) h.Authorization = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  const secret = trimEnv("ASKBIBLE_LEGACY_LOGIN_SECRET");
  if (secret) h["X-Selah-Auth"] = secret;
  return h;
}

function readBool(v: unknown): boolean {
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string" && ["true", "yes", "admin"].includes(v.toLowerCase())) return true;
  return false;
}

function pickUserRecord(j: Record<string, unknown>): Record<string, unknown> {
  const u = j.user;
  if (u && typeof u === "object" && !Array.isArray(u)) return u as Record<string, unknown>;
  const d = j.data;
  if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>;
  return j;
}

export type LegacyLoginOk = {
  ok: true;
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export type LegacyLoginFail = { ok: false; status: number; error?: string };

/**
 * POST 到旧站；成功时返回用户字段与是否管理员（由响应或 purpose 推断）。
 */
export async function postLegacyAskbibleLogin(
  url: string,
  email: string,
  password: string,
  purpose: "user" | "admin",
): Promise<LegacyLoginOk | LegacyLoginFail> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LEGACY_FETCH_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: legacyHeaders(),
      body: JSON.stringify({ email, password, purpose }),
      cache: "no-store",
      signal: controller.signal,
    });
    let j: Record<string, unknown> = {};
    try {
      j = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty */
    }
    const explicitFail =
      j.ok === false || j.success === false || j.authenticated === false || j.loggedIn === false;
    if (explicitFail) {
      const err =
        typeof j.error === "string"
          ? j.error
          : typeof j.message === "string"
            ? j.message
            : "Authentication failed";
      return { ok: false, status: 401, error: err };
    }
    const okFlag =
      j.ok === true ||
      j.success === true ||
      j.authenticated === true ||
      j.loggedIn === true ||
      j.status === "ok";
    if (!res.ok && !okFlag) {
      const err =
        typeof j.error === "string"
          ? j.error
          : typeof j.message === "string"
            ? j.message
            : `Legacy auth HTTP ${res.status}`;
      return { ok: false, status: res.status >= 400 && res.status < 600 ? res.status : 502, error: err };
    }
    if (!okFlag && res.ok) {
      return { ok: false, status: 502, error: "Legacy auth response missing ok flag" };
    }
    const row = pickUserRecord(j);
    const userId = String(row.id ?? row.userId ?? j.userId ?? j.id ?? "").trim();
    const emailOut = String(row.email ?? j.email ?? "").trim();
    const nameRaw = String(row.name ?? j.name ?? "").trim();
    if (!userId || !emailOut) {
      return { ok: false, status: 502, error: "Legacy auth response missing id or email" };
    }
    const name = nameRaw || emailOut;
    const isAdmin =
      readBool(j.isAdmin) ||
      readBool(j.admin) ||
      readBool(row.isAdmin) ||
      readBool(row.admin) ||
      row.is_admin === 1 ||
      row.role === "admin" ||
      (Array.isArray(j.roles) && (j.roles as unknown[]).includes("admin")) ||
      (Array.isArray(row.roles) && (row.roles as unknown[]).includes("admin"));

    if (purpose === "admin") {
      if (!isAdmin && !isSelahSuperAdminEmail(emailOut)) {
        return { ok: false, status: 403, error: "Not an administrator" };
      }
    }
    return { ok: true, userId, email: emailOut, name, isAdmin: isAdmin || isSelahSuperAdminEmail(emailOut) };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      error: aborted ? "Legacy auth timeout" : "Legacy auth unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}
