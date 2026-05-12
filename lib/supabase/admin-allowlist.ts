/**
 * 仅列在 `ADMIN_USER_EMAILS` 中的 Supabase 用户可进 `/admin`（逗号分隔，不区分大小写）。
 * 未配置或为空：启用 Supabase 时无人可进后台（避免误开放整站注册用户）。
 */
export function parseAdminUserEmails(): string[] {
  const raw = process.env.ADMIN_USER_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const allow = parseAdminUserEmails();
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}
