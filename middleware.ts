import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSelahOnlineEditorSurfaceAllowed } from "@/lib/selah-online-editor-surface";
import { isBackupEntryHost } from "@/lib/auth/public-auth-origin";

function isPrivilegedEditorPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPrivilegedEditorPath(pathname) && !isSelahOnlineEditorSurfaceAllowed()) {
    return new NextResponse(null, { status: 404 });
  }

  // AI Agent Markdown 内容协商：支持 /read/PSA/23.md 或 Accept: text/markdown
  const mdSuffixMatch = pathname.match(/^\/read\/([A-Za-z0-9]+)\/(\d+)\.md$/);
  const acceptHeader = (request.headers.get("accept") || "").toLowerCase();
  const wantsMarkdown = acceptHeader.includes("text/markdown") && !acceptHeader.includes("text/html");
  const readChapterMatch = !mdSuffixMatch && wantsMarkdown ? pathname.match(/^\/read\/([A-Za-z0-9]+)\/(\d+)$/) : null;
  const matchedChapter = mdSuffixMatch || readChapterMatch;
  if (matchedChapter && (request.method === "GET" || request.method === "HEAD")) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/api/read/markdown";
    rewriteUrl.searchParams.set("bookId", matchedChapter[1]);
    rewriteUrl.searchParams.set("chapter", matchedChapter[2]);
    return NextResponse.rewrite(rewriteUrl);
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
    "/api/admin/:path*",
  ],
};
