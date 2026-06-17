import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { readMemberSession } from "../auth/memberSession";
import { SCHEMA_VERSION } from "./memberAuthShared";
import type { MobileDeleteAccountResult } from "./memberAuthTypes";

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

  const base = getAskBibleBaseUrl();
  const res = await fetchWithTimeout(toAbsoluteUrl(base, "/api/mobile/auth/account"), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.sessionToken}`,
    },
    timeoutMs: 12_000,
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
