import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_GATE_COOKIE, verifyAdminGateCookie } from "@/lib/admin-gate";

function isAdminGatePublic(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return true;
  if (pathname === "/api/admin/auth") return true;
  if (pathname === "/api/admin/branding" && req.method === "GET") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  if (isAdminGatePublic(req)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_GATE_COOKIE)?.value;
  const ok = await verifyAdminGateCookie(cookie);
  if (ok) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  const login = new URL("/admin/login", req.url);
  login.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"],
};
