/** 反向代理后须看 `x-forwarded-proto`；勿仅用 NODE_ENV，否则线上偶发无法种下 Secure cookie。 */
export function authCookieSecure(req: Request): boolean {
  const fwd = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (fwd === "https") return true;
  if (fwd === "http") return false;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}
