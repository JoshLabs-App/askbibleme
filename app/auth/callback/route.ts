import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

/** 邮件链接 / OAuth 回调：换票后写 cookie，再跳回 `next`（默认 `/admin`） */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next")?.trim() || "/admin";
  const nextPath = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=auth", request.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Server Component 等场景可能不可写；middleware 会续期 */
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/admin/login?error=auth", request.url));
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
