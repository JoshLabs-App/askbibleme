import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseAuthConfigured } from "../config/supabaseAuth";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { readMemberSession } from "../auth/memberSession";
import { SCHEMA_VERSION } from "./memberAuthShared";
import type { MobileDeleteAccountResult } from "./memberAuthTypes";

/**
 * 删号：Supabase Edge Function `delete-account`（service role）。
 * 部署：`supabase functions deploy delete-account`
 */
export async function deleteMobileMemberAccount(): Promise<MobileDeleteAccountResult> {
  const session = await readMemberSession();
  if (!session?.sessionToken) {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "unauthorized",
      code: "unauthorized",
    };
  }

  if (!isSupabaseAuthConfigured()) {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "Supabase 未配置",
      code: "supabase_not_configured",
    };
  }

  const url = `${getSupabaseUrl().replace(/\/$/, "")}/functions/v1/delete-account`;
  const res = await fetchWithTimeout(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.sessionToken}`,
      apikey: getSupabaseAnonKey(),
    },
    timeoutMs: 15_000,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: `HTTP ${res.status}`,
      code: "invalid_response",
    };
  }

  const data = payload as Record<string, unknown>;
  const schemaVersion =
    typeof data.schemaVersion === "number" && Number.isFinite(data.schemaVersion)
      ? Math.trunc(data.schemaVersion)
      : SCHEMA_VERSION;

  if (!res.ok || data.ok !== true) {
    return {
      ok: false,
      schemaVersion,
      error: typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }

  return { ok: true, schemaVersion };
}
