import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import type { MobileAuthUser } from "./memberAuthTypes";

export const SCHEMA_VERSION = 1;

/** 线上 HTTPS — Android 真机 Debug 时 RN→Mac HTTP 不可靠，Google idToken 交换走此地址。 */
export const MOBILE_AUTH_PRODUCTION_BASE_URL = "https://askbible.me";

export function logAuthApiTarget(label: string): void {
  if (!__DEV__) return;
  console.warn(`[memberAuth] ${label} → ${getAskBibleBaseUrl()}`);
}

export function parseAuthUser(data: Record<string, unknown>): MobileAuthUser | null {
  const user = data.user as Record<string, unknown> | undefined;
  if (!user || typeof user.id !== "string" || typeof user.email !== "string") return null;
  const createdAt =
    typeof user.createdAt === "string" && user.createdAt.trim()
      ? user.createdAt.trim()
      : typeof user.created_at === "string" && user.created_at.trim()
        ? user.created_at.trim()
        : null;
  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" ? user.name : user.email,
    locale: typeof user.locale === "string" ? user.locale : user.locale === null ? null : undefined,
    createdAt,
  };
}
