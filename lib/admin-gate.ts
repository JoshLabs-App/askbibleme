/**
 * 管理后台 cookie 门禁（HMAC）与 `/api/admin/auth` 共用。
 * 当前未接 `middleware`：后台路由可直接访问；恢复门禁时加回 `middleware.ts` 并校验 `verifyAdminGateCookie`。
 * 生产若再启用登录，请设置 `ADMIN_PASSWORD` 与 `ADMIN_GATE_SECRET`（任意长随机串）。
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
