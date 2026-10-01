import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

/** Safe in-app redirect target after login / OAuth callback. */
export function sanitizeAuthNextPath(
  raw: string | null | undefined,
  fallback: string = WEB_APP_HOME_PATH,
): string {
  const next = raw?.trim() || fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  /** 根路径是官网；登录完要回的是网页版（含旧链接里带的 `next=/`） */
  if (next === "/") return fallback;
  if (next === "/login" || next === "/register" || next.startsWith("/auth/callback")) return fallback;
  return next;
}
