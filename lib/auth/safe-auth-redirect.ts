/** Safe in-app redirect target after login / OAuth callback. */
export function sanitizeAuthNextPath(raw: string | null | undefined, fallback = "/"): string {
  const next = raw?.trim() || fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next === "/login" || next === "/register" || next.startsWith("/auth/callback")) return fallback;
  return next;
}
