import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_ASKBIBLE_SESSION_COOKIE,
  verifyAskbibleSessionCookie,
} from "@/lib/admin-askbible-session";
import { ADMIN_GATE_COOKIE, verifyAdminGateCookie } from "@/lib/admin-gate";
import { isSelahOnlineEditorSurfaceAllowed } from "@/lib/selah-online-editor-surface";
import { SELAH_REQUEST_PATHNAME_HEADER } from "@/lib/read/request-pathname";

function nextWithRequestPathname(request: NextRequest, init?: ResponseInit) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SELAH_REQUEST_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ ...init, request: { headers: requestHeaders } });
}

function isPrivilegedEditorPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/api/studio") ||
    pathname.startsWith("/api/ai")
  );
}

/** `/admin`：AskBible 管理 cookie → 工作室 HMAC cookie。 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPrivilegedEditorPath(pathname) && !isSelahOnlineEditorSurfaceAllowed()) {
    return new NextResponse(null, { status: 404 });
  }

  if (!pathname.startsWith("/admin")) {
    return nextWithRequestPathname(request);
  }

  const askbibleCookie = request.cookies.get(ADMIN_ASKBIBLE_SESSION_COOKIE)?.value;
  if (await verifyAskbibleSessionCookie(askbibleCookie)) {
    if (pathname === "/admin/login") {
      const nextRaw = request.nextUrl.searchParams.get("next")?.trim() || "/admin";
      const safe = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
      return NextResponse.redirect(new URL(safe, request.nextUrl.origin));
    }
    return nextWithRequestPathname(request);
  }

  if (pathname === "/admin/login") {
    return nextWithRequestPathname(request);
  }

  const raw = request.cookies.get(ADMIN_GATE_COOKIE)?.value;
  if (await verifyAdminGateCookie(raw)) {
    return nextWithRequestPathname(request);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  const next = `${pathname}${search}`;
  url.searchParams.set("next", next.startsWith("/admin") ? next : "/admin");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/music/upload|api/music/upload-image|api/nature/upload|api/nature/upload-audio|api/nature/upload-thumb|health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|mp3|mp4|webm|json|css|js)).*)",
    "/admin/:path*",
    "/api/admin/:path*",
    "/studio/:path*",
    "/api/studio/:path*",
    "/api/ai/:path*",
  ],
};
