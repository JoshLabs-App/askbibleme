import { NextResponse } from "next/server";

/** 兼容旧回调入口：当前不再使用第三方认证，统一回到后台登录页。 */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
