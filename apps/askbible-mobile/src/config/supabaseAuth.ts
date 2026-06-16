import Constants from "expo-constants";

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabaseUrl(): string {
  return (
    trim(process.env.EXPO_PUBLIC_SUPABASE_URL) ||
    trim(Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ||
    ""
  );
}

export function getSupabaseAnonKey(): string {
  return (
    trim(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    trim(Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ||
    ""
  );
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
