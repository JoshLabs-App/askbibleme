/**
 * 系统固定超级管理员（与 AskBible `auth.sqlite` 中 `users.email` 一致即可，不要求 `is_admin`）。
 * 用于：/admin 门禁、Supabase 后台白名单、前台「管理」入口显隐。
 */
export const SELAH_SUPER_ADMIN_EMAIL = "502299900@qq.com";

export function isSelahSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return email.trim().toLowerCase() === SELAH_SUPER_ADMIN_EMAIL.toLowerCase();
}
