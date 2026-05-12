/**
 * 管理后台 cookie 门禁（HMAC）与 `/api/admin/auth`、`middleware.ts` 共用。
 * 当已配置 `NEXT_PUBLIC_SUPABASE_URL` + anon key 时，/admin 走 Supabase 账号 + `ADMIN_USER_EMAILS`，不再使用本 cookie。
 */

export const ADMIN_GATE_COOKIE = "selah_admin_gate";

const GATE_PAYLOAD_PREFIX = "admin|v1|";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "dddd";
}

export function getAdminGateSecret(): string {
  return process.env.ADMIN_GATE_SECRET?.trim() || "selah-admin-gate-dev";
}

/** Edge / Node 均可用 */
export async function computeAdminGateToken(): Promise<string> {
  const secret = getAdminGateSecret();
  const password = getAdminPassword();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${GATE_PAYLOAD_PREFIX}${password}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAdminGateCookie(value: string | undefined | null): Promise<boolean> {
  if (!value || typeof value !== "string") return false;
  const expected = await computeAdminGateToken();
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
