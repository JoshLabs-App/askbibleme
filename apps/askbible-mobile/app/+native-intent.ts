/** OAuth 回调只交给 auth 模块；勿 import src/auth（启动阶段加载 Supabase 可能导致白屏）。 */
import { widgetReadChapterExpoPath } from "../src/widget/widget-read-chapter-url";

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
    !trimmed.includes("dev/plan-flow-pool-live")
  ) {
    return null;
  }
  const normalized = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/?/i, "");
  const route = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (route.startsWith("/dev/reading-alarm")) return route;
  if (route.startsWith("/dev/plan-flow-e2e")) return route;
  if (route.startsWith("/dev/plan-flow-pool-live")) return route;
  return null;
}

function exploreExpoPath(path: string): string | null {
  const trimmed = path.trim();
  const normalized = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/?/i, "");
  const route = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (route.startsWith("/explore/") || route.startsWith("/read/")) return route;
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
    const readPath = widgetReadChapterExpoPath(path);
    if (readPath) return readPath;
    const devAlarmPath = devReadingAlarmExpoPath(path);
    if (devAlarmPath) return devAlarmPath;
    const explorePath = exploreExpoPath(path);
    if (explorePath) return explorePath;
    if (isUnmappedAppDeepLink(path)) return "/";
  } catch {
    // keep path
  }
  return path;
}
