import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * 刷新 Supabase Auth cookie，并返回当前用户邮箱（供 `/admin` 门禁使用）。
 * 未配置 Supabase 时仅透传 `NextResponse.next({ request })`。
 */
export async function updateSupabaseSession(request: NextRequest): Promise<{
  response: NextResponse;
  userEmail: string | null;
}> {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return { response, userEmail: null };
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([k, v]) => {
          response.headers.set(k, v);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, userEmail: user?.email ?? null };
}

export function copyCookiesTo(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
}
