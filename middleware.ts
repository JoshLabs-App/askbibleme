import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSelahOnlineEditorSurfaceAllowed } from "@/lib/selah-online-editor-surface";
import { isBackupEntryHost } from "@/lib/auth/public-auth-origin";

function isPrivilegedEditorPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/studio" ||
    pathname.startsWith("/studio/") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/studio") ||
    pathname.startsWith("/api/ai")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPrivilegedEditorPath(pathname) && !isSelahOnlineEditorSurfaceAllowed()) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.next();
  if (isBackupEntryHost(request.headers.get("host"))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/sync|health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|mp3|mp4|webm|json|css|js)).*)",
    "/admin/:path*",
    "/studio/:path*",
    "/api/admin/:path*",
    "/api/studio/:path*",
    "/api/ai/:path*",
  ],
};
