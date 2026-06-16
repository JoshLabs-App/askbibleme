import { NextResponse } from "next/server";

/** 将 source 上的 Set-Cookie 复制到新的 JSON 响应（Supabase SSR 登录后常用）。 */
export function jsonResponseWithCookies<T>(
  body: T,
  source: NextResponse,
  init?: ResponseInit,
): NextResponse {
  const out = NextResponse.json(body, init);
  for (const cookie of source.cookies.getAll()) {
    out.cookies.set(cookie);
  }
  return out;
}
