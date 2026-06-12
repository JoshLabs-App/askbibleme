import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

export async function createSupabaseServerClient(response?: NextResponse) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (response) {
            response.cookies.set(name, value, options);
          } else {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Route handlers may be read-only; caller should pass response.
            }
          }
        });
      },
    },
  });
}
