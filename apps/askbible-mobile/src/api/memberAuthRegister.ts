import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import {
  parseAuthUser,
  SCHEMA_VERSION,
} from "./memberAuthShared";
import type { MobileRegisterRequest, MobileRegisterResult } from "./memberAuthTypes";

export async function registerMobileMember(input: MobileRegisterRequest): Promise<MobileRegisterResult> {
  const base = getAskBibleBaseUrl();
  const res = await fetchWithTimeout(`${base}/api/mobile/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeoutMs: 12_000,
    body: JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      email: input.email,
      password: input.password,
      name: input.name ?? "",
      locale: input.locale ?? "",
      source: input.source ?? "askbible-mobile",
    }),
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

  const user = parseAuthUser(data);
  const sessionToken = typeof data.sessionToken === "string" ? data.sessionToken : "";
  const expiresAt = typeof data.expiresAt === "string" ? data.expiresAt : "";
  if (!user || !sessionToken || !expiresAt) {
    return {
      ok: false,
      schemaVersion,
      error: "Invalid auth response",
      code: "invalid_response",
    };
  }

  return {
    ok: true,
    schemaVersion,
    user,
    sessionToken,
    expiresAt,
    nextAction: "login",
  };
}
