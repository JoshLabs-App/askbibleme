import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import type { MobileAuthUser } from "./memberAuthTypes";

export const SCHEMA_VERSION = 1;

/**
 * OAuth idToken 交换直连 Supabase Edge Function，不经过 askbible.me/Render——
 * 减少对 Render 服务可用性的依赖，登录不受站点部署影响。函数名与
 * supabase/functions/mobile-oauth-{google,apple}/ 对应。
 */
export const MOBILE_OAUTH_EDGE_FUNCTION_BASE_URL =
  "https://tgobadhdylarhssudplc.supabase.co/functions/v1";

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
