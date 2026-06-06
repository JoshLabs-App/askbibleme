import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";

const SCHEMA_VERSION = 1;

export type MobileRegisterRequest = {
  email: string;
  password: string;
  name?: string;
  locale?: string;
  source?: string;
};

export type MobileRegisterResult =
  | {
      ok: true;
      schemaVersion: number;
      user: { id: string; email: string; name: string };
      nextAction: "login";
    }
  | {
      ok: false;
      schemaVersion: number;
      error: string;
      code?: string;
    };

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

  const user = data.user as Record<string, unknown> | undefined;
  return {
    ok: true,
    schemaVersion,
    user: {
      id: typeof user?.id === "string" ? user.id : "",
      email: typeof user?.email === "string" ? user.email : "",
      name: typeof user?.name === "string" ? user.name : "",
    },
    nextAction: "login",
  };
}
