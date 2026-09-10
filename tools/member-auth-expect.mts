// TS 侧期望值：readMemberSession 需要 AsyncStorage，这里用它的解析规则（memberSession.ts 源码照抄）；
// normalize / isValid 直接调 RN explore-birth-year-prefs（去掉 import 后载入）；mapAuthErrorMessage / displayNameFromUser 照抄 supabaseMemberAuth.ts。
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "memberauth-ts-"));
function pureModule(rel: string, header: string): string {
  const stripped = readFileSync(path.join(ROOT, rel), "utf8").replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "");
  const out = path.join(dir, path.basename(rel).replace(/\.ts$/, ".mts"));
  writeFileSync(out, header + "\n" + stripped);
  return out;
}
const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);
const prefsMod = pureModule("apps/askbible-mobile/src/explore/explore-birth-year-prefs.ts", "const AsyncStorage: any = {};");
const P: any = unwrap(await import(prefsMod));
function mapAuthErrorMessage(message: string): { error: string; code: string } {
  const msg = message.trim() || "auth_failed";
  if (/invalid login credentials|invalid_credentials/i.test(msg)) return { error: "邮箱或密码不正确。", code: "invalid_credentials" };
  if (/email not confirmed/i.test(msg)) return { error: "请先完成邮箱验证后再登录。", code: "email_not_confirmed" };
  if (/user already registered|already been registered/i.test(msg)) return { error: "该邮箱已注册。", code: "email_taken" };
  if (/network request failed|failed to fetch|network error|timed out|failed to connect/i.test(msg)) return { error: "network", code: "network" };
  return { error: msg, code: "auth_failed" };
}
function displayNameFromUser(user: { email: string; id: string; user_metadata: Record<string, string> }, fallbackName?: string): string {
  const trimmed = fallbackName?.trim();
  if (trimmed) return trimmed;
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  if (typeof meta?.display_name === "string" && meta.display_name.trim()) return meta.display_name.trim();
  return user.email || user.id;
}
function readMemberSession(raw: string, now: number) {
  try {
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.sessionToken !== "string" || !parsed.sessionToken.trim() || typeof parsed.expiresAt !== "string" ||
      !parsed.user || typeof parsed.user.id !== "string" || typeof parsed.user.email !== "string") return null;
    if (Date.parse(parsed.expiresAt) <= now) return null;
    return {
      sessionToken: parsed.sessionToken.trim(), expiresAt: parsed.expiresAt,
      user: { id: parsed.user.id, email: parsed.user.email, name: typeof parsed.user.name === "string" ? parsed.user.name : parsed.user.email,
        locale: typeof parsed.user.locale === "string" ? parsed.user.locale : null,
        createdAt: typeof parsed.user.createdAt === "string" && parsed.user.createdAt.trim() ? parsed.user.createdAt.trim() : null },
    };
  } catch { return null; }
}
// 第三方登录：resolveMemberOAuthError 直接调 RN 源码（无 import）；isGoogleOAuthCallbackUrl / parseQueryParams 在 googleOAuthSession.ts
// （拖着 supabase-js 与 polyfill），照抄；authorize URL 照抄 supabase-js _getUrlForProvider；formatAppleFullName 照抄 appleSignIn.ts。
const O: any = unwrap(await import(path.join(ROOT, "apps/askbible-mobile/src/auth/resolveMemberOAuthError.ts")));
const OAUTH_COPY: Record<string, string> = {
  "auth.errorNetwork": "网络连接失败，请稍后再试。", "auth.registerClosed": "注册功能暂时关闭",
  "auth.errorOAuthGoogle": "Google 登录失败，请重试。", "auth.errorOAuthGoogleNotConfigured": "Google 登录暂时不可用，请稍后再试。",
  "auth.errorOAuthApple": "Apple 登录失败，请重试。", "auth.errorOAuthAppleNotConfigured": "Apple 登录尚未配置。请在 Supabase 的 Apple 提供商中登记 Bundle ID：me.askbible.native。",
};
const tCopy = (k: string) => OAUTH_COPY[k] ?? k;
function isGoogleOAuthCallbackUrl(url: string): boolean {
  if (url.startsWith("askbible://auth/callback")) return true;
  try { const u = new URL(url); return u.pathname === "/auth/callback" || u.pathname === "/auth/mobile-callback"; } catch { return false; }
}
function parseQueryParams(url: string): { params: Record<string, string>; errorCode: string | null } {
  const queryIndex = url.indexOf("?"); const hashIndex = url.indexOf("#"); const params: Record<string, string> = {};
  const readSegment = (segment: string) => { for (const part of segment.split("&")) { if (!part) continue; const [rawKey, ...rest] = part.split("=");
    const key = decodeURIComponent(rawKey || ""); const value = decodeURIComponent(rest.join("=") || ""); if (key) params[key] = value; } };
  if (queryIndex >= 0) { const end = hashIndex >= 0 ? hashIndex : url.length; readSegment(url.slice(queryIndex + 1, end)); }
  if (hashIndex >= 0) readSegment(url.slice(hashIndex + 1));
  return { params, errorCode: params.error_code || params.error || null };
}
function providerUrl(provider: string, redirectTo: string, challenge: string): string {
  const urlParams = [`provider=${encodeURIComponent(provider)}`, `redirect_to=${encodeURIComponent(redirectTo)}`];
  urlParams.push(new URLSearchParams({ code_challenge: `${encodeURIComponent(challenge)}`, code_challenge_method: "s256" }).toString());
  return `https://tgobadhdylarhssudplc.supabase.co/auth/v1/authorize?${urlParams.join("&")}`;
}
function formatAppleFullName(fullName: { givenName: string | null; familyName: string | null } | null): string | undefined {
  if (!fullName) return undefined; const parts = [fullName.givenName, fullName.familyName].filter(Boolean); const joined = parts.join(" ").trim(); return joined || undefined;
}
function idTokenFailureCode(provider: string, msg: string): string {
  if (provider === "apple") return /not configured|client_id|client id|bundle|audience/i.test(msg) ? "apple_not_configured" : "apple_auth_failed";
  return /nonce/i.test(msg) && /(both exist|mismatch|id_token)/i.test(msg) ? "google_nonce_mismatch" : "google_auth_failed";
}
const lines = readFileSync(0, "utf8").split("\n"); if (lines[lines.length - 1] === "") lines.pop();
const out: string[] = [];
for (const line of lines) {
  const f = line.split("\t");
  switch (f[0]) {
    case "err": { const m = mapAuthErrorMessage(f[1]); out.push(`${m.error}|${m.code}`); break; }
    case "name": { const meta: Record<string, string> = {}; if (f[3]) meta.full_name = f[3]; if (f[4]) meta.name = f[4]; if (f[5]) meta.display_name = f[5];
      out.push(displayNameFromUser({ email: f[1], id: f[2], user_metadata: meta }, f[6] || undefined)); break; }
    case "session": { const s = readMemberSession(f[1], Date.parse(f[2])); out.push(s ? `${s.sessionToken}|${s.user.id}|${s.user.email}|${s.user.name}|${s.user.locale ?? "-"}|${s.user.createdAt ?? "-"}` : "null"); break; }
    case "norm": out.push(`${P.normalizeExploreDisplayName(f[1])}|${P.isValidExploreDisplayName(f[1]) ? 1 : 0}`); break;
    case "greet": { const name = f[1]; if (!name) { out.push("请登录，解锁更多"); break; } const n = P.normalizeExploreDisplayName(name); out.push(`你好，${n || "用户"}`); break; }
    case "exp": { const ms = f[1] ? Number(f[1]) * 1000 : Date.parse(f[2]) + 3600_000; out.push(new Date(ms).toISOString()); break; }
    case "pkce": out.push(createHash("sha256").update(f[1]).digest("base64url")); break;
    case "nonce": out.push(createHash("sha256").update(f[1]).digest("hex")); break;
    case "authurl": out.push(providerUrl(f[1], f[2], f[3])); break;
    case "cburl": out.push(isGoogleOAuthCallbackUrl(f[1]) ? "1" : "0"); break;
    case "cbparse": { const { params, errorCode } = parseQueryParams(f[1]); const code = params.code?.trim() || null;
      out.push(`${code ?? "-"}|${errorCode ?? "-"}|${params.access_token?.trim() || "-"}|${params.refresh_token?.trim() || "-"}`); break; }
    case "oautherr": out.push(O.resolveMemberOAuthError(f[1], tCopy, { code: f[2] || undefined, error: f[3] || undefined, cancelled: f[4] === "1" }) ?? "null"); break;
    case "applename": out.push(formatAppleFullName({ givenName: f[1] || null, familyName: f[2] || null }) ?? "null"); break;
    case "idcode": out.push(idTokenFailureCode(f[1], f[2])); break;
    default: out.push("skip");
  }
}
console.log(JSON.stringify(out));
