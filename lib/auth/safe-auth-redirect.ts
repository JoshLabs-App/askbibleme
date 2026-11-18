import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

/** Safe in-app redirect target after login / OAuth callback. */
export function sanitizeAuthNextPath(
  raw: string | null | undefined,
  fallback: string = WEB_APP_HOME_PATH,
): string {
  const next = raw?.trim() || fallback;
  // Browsers normalize backslashes and strip tabs/newlines before resolving URLs.
  // Reject those spellings before parsing so a seemingly local path cannot change origin.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  const base = "https://askbible.invalid";
  let target: URL;
  try {
    target = new URL(next, base);
  } catch {
    return fallback;
  }
  if (target.origin !== base) return fallback;
  const pathname = target.pathname;
  /** 根路径是官网；登录完要回的是网页版（含旧链接里带的 `next=/`） */
  if (pathname === "/") return fallback;
  if (/^\/(login|register)(\/|$)/.test(pathname) || pathname.startsWith("/auth/callback")) return fallback;
  return `${pathname}${target.search}${target.hash}`;
}
