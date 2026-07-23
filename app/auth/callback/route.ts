import { NextResponse } from "next/server";
import { sanitizeAuthNextPath } from "@/lib/auth/safe-auth-redirect";
import { isMobileAppOAuthCallback } from "@/lib/auth/mobile-oauth-app-handoff";
import { buildMobileOAuthLandingHtml } from "@/lib/auth/mobile-oauth-landing-html";
import { resolvePublicAuthOrigin } from "@/lib/auth/public-auth-origin";
import { fetchAskbibleProfile, upsertAskbibleProfile } from "@/lib/askbible-supabase-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeAuthNextPath(url.searchParams.get("next"));
  const origin = resolvePublicAuthOrigin(request);
  const isMobileBrowserFlow = isMobileAppOAuthCallback(url.searchParams);

  if (!isSupabaseAuthConfigured()) {
    if (isMobileBrowserFlow) {
      return mobileOAuthLandingResponse("Google 登录失败，请返回 AskBible.me App 重试。", 400);
    }
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (url.searchParams.get("error")) {
    if (isMobileBrowserFlow) {
      return mobileOAuthLandingResponse("Google 登录失败，请返回 AskBible.me App 重试。", 400);
    }
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (!code) {
    if (isMobileBrowserFlow) {
      return mobileOAuthLandingResponse("Google 登录失败，请返回 AskBible.me App 重试。", 400);
    }
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (isMobileBrowserFlow) {
    return mobileOAuthLandingResponse("登录成功，请返回 AskBible.me App。", 200);
  }

  const response = NextResponse.redirect(new URL(next, origin));
  const supabase = await createSupabaseServerClient(response);
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  const profile = await fetchAskbibleProfile(supabase, data.user.id);
  if (!profile) {
    const meta = data.user.user_metadata;
    const name =
      typeof meta?.name === "string"
        ? meta.name.trim()
        : typeof meta?.full_name === "string"
          ? meta.full_name.trim()
          : data.user.email || data.user.id;
    try {
      await upsertAskbibleProfile({
        userId: data.user.id,
        displayName: name,
        locale: "zh",
      });
    } catch {
      // Session is valid; profile can be repaired later.
    }
  }

  return response;
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
