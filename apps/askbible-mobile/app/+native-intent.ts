/** OAuth 回调只交给 auth 模块；勿 import src/auth（启动阶段加载 Supabase 可能导致白屏）。 */
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

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (isOAuthCallbackPath(path)) return "/";
  } catch {
    // keep path
  }
  return path;
}
