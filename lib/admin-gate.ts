/**
 * 管理后台简易门禁：cookie 存 HMAC(secret, password)，与 `middleware` / `api/admin/auth` 共用。
 * 生产环境请设置 `ADMIN_PASSWORD` 与 `ADMIN_GATE_SECRET`（任意长随机串）。
 *
 * 临时测试：`SELAH_ADMIN_DEV_GATE=1` 时忽略 `ADMIN_PASSWORD`，登录口令固定为 `dddd`。
 * 上线前删除该变量（及仓库根 `vercel.json` 里对应项），并改用强密码 + 独立 `ADMIN_GATE_SECRET`。
 */

export const ADMIN_GATE_COOKIE = "selah_admin_gate";

const GATE_PAYLOAD_PREFIX = "admin|v1|";

function isDevAdminGateEnabled(): boolean {
  const v = process.env.SELAH_ADMIN_DEV_GATE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getAdminPassword(): string {
  if (isDevAdminGateEnabled()) return "dddd";
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
