import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase URL / anon key missing (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  }
  return createBrowserClient(url, key);
}
