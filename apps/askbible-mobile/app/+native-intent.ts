/** OAuth 回调只交给 auth 模块；勿 import src/auth（启动阶段加载 Supabase 可能导致白屏）。 */
import { widgetReadChapterExpoPath } from "../src/widget/widget-read-chapter-url";

function isWidgetPlaybackDeepLink(path: string): boolean {
  const trimmed = path.trim();
  return /askbible:/i.test(trimmed) && /widget\/play/i.test(trimmed);
}

function isOAuthCallbackPath(path: string): boolean {
  const raw = path.trim();
  if (!raw) return false;
  if (raw.startsWith("askbible://auth/callback") || raw.startsWith("askbible://auth/mobile-callback")) {
    return true;
  }
  const normalized = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return (
    normalized.startsWith("auth/callback") ||
    normalized.startsWith("/auth/callback") ||
    normalized.startsWith("auth/mobile-callback") ||
    normalized.startsWith("/auth/mobile-callback") ||
    normalized.includes("/auth/callback") ||
    normalized.includes("/auth/mobile-callback")
  );
}

function isBareAppDeepLink(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return true;
  return /^askbible:\/?\/?$/i.test(trimmed);
}

function isUnmappedAppDeepLink(path: string): boolean {
  return /^askbible:/i.test(path.trim());
}

function devReadingAlarmExpoPath(path: string): string | null {
  const trimmed = path.trim();
  if (
    !trimmed.includes("dev/reading-alarm") &&
    !trimmed.includes("dev/plan-flow-e2e") &&
    !trimmed.includes("dev/plan-activate-e2e") &&
    !trimmed.includes("dev/plan-flow-pool-live") &&
    !trimmed.includes("dev/maestro-smoke-prep")
  ) {
    return null;
  }
  const normalized = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/?/i, "");
  const route = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (route.startsWith("/dev/reading-alarm")) return route;
  if (route.startsWith("/dev/plan-flow-e2e")) return route;
  if (route.startsWith("/dev/plan-activate-e2e")) return route;
  if (route.startsWith("/dev/plan-flow-pool-live")) return route;
  if (route.startsWith("/dev/maestro-smoke-prep")) return route;
  return null;
}

function exploreExpoPath(path: string): string | null {
  const trimmed = path.trim();
  const normalized = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/?/i, "");
  const route = normalized.startsWith("/") ? normalized : `/${normalized}`;
  // 旧深链：欢迎已迁出 Explore → 根栈 /welcome
  if (route === "/explore/welcome" || route.startsWith("/explore/welcome/")) {
    return "/welcome";
  }
  if (route.startsWith("/explore/") || route.startsWith("/read/") || route === "/welcome" || route.startsWith("/welcome/")) {
    return route;
  }
  return null;
}

function tabExpoPath(path: string): string | null {
  const trimmed = path.trim();
  const normalized = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/?/i, "");
  const route = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (route === "/music" || route.startsWith("/music/")) return "/music";
  if (route === "/login" || route.startsWith("/login/")) return "/login";
  return null;
}

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (isOAuthCallbackPath(path)) return "/";
    if (isBareAppDeepLink(path)) return "/";
    // 挂件播放深链：路由进首页，实际开播由 WidgetPlaybackDeepLinkBridge 处理。
    if (isWidgetPlaybackDeepLink(path)) return "/";
    const readPath = widgetReadChapterExpoPath(path);
    if (readPath) return readPath;
    const devAlarmPath = devReadingAlarmExpoPath(path);
    if (devAlarmPath) return devAlarmPath;
    const explorePath = exploreExpoPath(path);
    if (explorePath) return explorePath;
    const tabPath = tabExpoPath(path);
    if (tabPath) return tabPath;
    if (isUnmappedAppDeepLink(path)) return "/";
  } catch {
    // keep path
  }
  return path;
}
