import { getAdminGateSecret } from "@/lib/admin-gate";

/** 复用 AskBible 登录成功后签发；middleware（Edge）仅校验 HMAC，不读 SQLite */
export const ADMIN_ASKBIBLE_SESSION_COOKIE = "selah_admin_askbible";

export type AskbibleSessionPayload = {
  v: 1;
  sub: string;
  email: string;
  exp: number;
};

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signAskbibleSessionCookie(payload: AskbibleSessionPayload): Promise<string> {
  const secret = getAdminGateSecret();
  const body = utf8ToBase64Url(JSON.stringify(payload));
  const sig = await hmacSha256Hex(secret, body);
  return `${body}.${sig}`;
}

export async function verifyAskbibleSessionCookie(raw: string | undefined | null): Promise<boolean> {
  if (!raw || typeof raw !== "string" || !raw.includes(".")) return false;
  const last = raw.lastIndexOf(".");
  const body = raw.slice(0, last);
  const sig = raw.slice(last + 1);
  const expected = await hmacSha256Hex(getAdminGateSecret(), body);
  if (!timingSafeEqualHex(sig, expected)) return false;
  try {
    const txt = base64UrlToUtf8(body);
    const j = JSON.parse(txt) as AskbibleSessionPayload;
    if (j.v !== 1 || typeof j.exp !== "number" || typeof j.sub !== "string" || typeof j.email !== "string") {
      return false;
    }
    if (Date.now() > j.exp) return false;
    return true;
  } catch {
    return false;
  }
}
