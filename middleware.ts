import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_ASKBIBLE_SESSION_COOKIE,
  USER_ASKBIBLE_SESSION_COOKIE,
  parseAskbibleSessionCookie,
  verifyAskbibleSessionCookie,
} from "@/lib/admin-askbible-session";
import { ADMIN_GATE_COOKIE, verifyAdminGateCookie } from "@/lib/admin-gate";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";
import { isAdminEmail } from "@/lib/supabase/admin-allowlist";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { copyCookiesTo, updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * `/admin`：AskBible 管理 cookie → 固定超级管理员前台会话 → Supabase + 白名单 → 工作室 HMAC cookie。
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const askbibleCookie = request.cookies.get(ADMIN_ASKBIBLE_SESSION_COOKIE)?.value;
  if (await verifyAskbibleSessionCookie(askbibleCookie)) {
    if (pathname === "/admin/login") {
      const nextRaw = request.nextUrl.searchParams.get("next")?.trim() || "/admin";
      const safe = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
      return NextResponse.redirect(new URL(safe, request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  const { response: supaResponse, userEmail } = await updateSupabaseSession(request);

  const userCookieRaw = request.cookies.get(USER_ASKBIBLE_SESSION_COOKIE)?.value;
  const userPayload = await parseAskbibleSessionCookie(userCookieRaw);
  const superAdminViaUserCookie = Boolean(userPayload && isSelahSuperAdminEmail(userPayload.email));

  if (isSupabaseConfigured()) {
    const adminOk = Boolean(userEmail && isAdminEmail(userEmail)) || superAdminViaUserCookie;

    if (pathname === "/admin/login") {
      if (adminOk) {
        const nextRaw = request.nextUrl.searchParams.get("next")?.trim() || "/admin";
        const safe = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
        const target = new URL(safe, request.nextUrl.origin);
        const redirectResponse = NextResponse.redirect(target);
        copyCookiesTo(supaResponse, redirectResponse);
        return redirectResponse;
      }
      return supaResponse;
    }

    if (adminOk) {
      return supaResponse;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    if (userEmail) {
      loginUrl.searchParams.set("error", "forbidden");
    }
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookiesTo(supaResponse, redirectResponse);
    return redirectResponse;
  }

  if (pathname === "/admin/login") {
    if (superAdminViaUserCookie) {
      const nextRaw = request.nextUrl.searchParams.get("next")?.trim() || "/admin";
      const safe = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
      return NextResponse.redirect(new URL(safe, request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (superAdminViaUserCookie) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(ADMIN_GATE_COOKIE)?.value;
  if (await verifyAdminGateCookie(raw)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  const next = `${pathname}${search}`;
  url.searchParams.set("next", next.startsWith("/admin") ? next : "/admin");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
