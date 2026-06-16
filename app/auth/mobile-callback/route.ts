import { NextResponse } from "next/server";
import { buildMobileOAuthLandingHtml } from "@/lib/auth/mobile-oauth-landing-html";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

/** App 浏览器 OAuth 回调：仅展示落地页；session 由 App 内 exchangeCodeForSession 完成。 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  if (!isSupabaseAuthConfigured()) {
    return mobileOAuthLandingResponse("Google 登录失败，请返回 AskBible.me App 重试。", 400);
  }

  if (url.searchParams.get("error")) {
    return mobileOAuthLandingResponse("Google 登录失败，请返回 AskBible.me App 重试。", 400);
  }

  if (!url.searchParams.get("code")) {
    return mobileOAuthLandingResponse("Google 登录失败，请返回 AskBible.me App 重试。", 400);
  }

  return mobileOAuthLandingResponse("登录成功，请返回 AskBible.me App。", 200);
}

function mobileOAuthLandingResponse(message: string, status: number): NextResponse {
  return new NextResponse(buildMobileOAuthLandingHtml(message), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
