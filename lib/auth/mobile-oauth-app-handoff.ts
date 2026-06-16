/** App 浏览器 OAuth：无 `next`（网页登录必带）；Supabase 回落 Site URL 时同理。 */
export function isMobileAppOAuthCallback(searchParams: URLSearchParams): boolean {
  if (!searchParams.get("code")?.trim()) return false;
  if (searchParams.get("flow") === "mobile") return true;
  return !searchParams.get("next")?.trim();
}
