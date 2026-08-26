import { signUpWithPasswordInApp } from "../auth/supabaseMemberAuth";
import { isSupabaseAuthConfigured } from "../config/supabaseAuth";
import { SCHEMA_VERSION } from "./memberAuthShared";
import type { MobileRegisterRequest, MobileRegisterResult } from "./memberAuthTypes";

export async function registerMobileMember(input: MobileRegisterRequest): Promise<MobileRegisterResult> {
  if (!isSupabaseAuthConfigured()) {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "Supabase 未配置",
      code: "supabase_not_configured",
    };
  }
  return signUpWithPasswordInApp(input);
}
