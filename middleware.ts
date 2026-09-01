import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSelahOnlineEditorSurfaceAllowed } from "@/lib/selah-online-editor-surface";
import { SELAH_REQUEST_PATHNAME_HEADER } from "@/lib/read/request-pathname";

function nextWithRequestPathname(request: NextRequest, init?: ResponseInit) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SELAH_REQUEST_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ ...init, request: { headers: requestHeaders } });
}

function isPrivilegedEditorPath(pathname: string): boolean {
  return (
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/api/studio") ||
    pathname.startsWith("/api/ai")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Supabase OAuth may fall back to Site URL (/) with ?code= when redirectTo is not allow-listed.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  if (isPrivilegedEditorPath(pathname) && !isSelahOnlineEditorSurfaceAllowed()) {
    return new NextResponse(null, { status: 404 });
  }

  return nextWithRequestPathname(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/music/upload|api/music/upload-image|api/nature/upload|api/nature/upload-audio|api/nature/upload-thumb|health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|mp3|mp4|webm|json|css|js)).*)",
    "/studio/:path*",
    "/api/studio/:path*",
    "/api/ai/:path*",
  ],
};
