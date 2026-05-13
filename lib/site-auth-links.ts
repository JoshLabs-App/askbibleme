/**
 * 前台注册入口：部署时在 Vercel 等处配置为旧站注册页完整 URL（https://…）。
 * 未配置时仍提供站内 `/register` 说明页。
 */
export function getPublicRegisterUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_ASKBIBLE_REGISTER_URL?.trim();
  return u || null;
}
