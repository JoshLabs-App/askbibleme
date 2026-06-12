import { NextResponse } from "next/server";
import { sanitizeAuthNextPath } from "@/lib/auth/safe-auth-redirect";
import { fetchAskbibleProfile, upsertAskbibleProfile } from "@/lib/askbible-supabase-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeAuthNextPath(url.searchParams.get("next"));
  const origin = url.origin;

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
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
