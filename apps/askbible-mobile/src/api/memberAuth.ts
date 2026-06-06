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

export type MobileLoginRequest = {
  email: string;
  password: string;
};

type MobileAuthUser = { id: string; email: string; name: string };

export type MobileRegisterResult =
  | {
      ok: true;
      schemaVersion: number;
      user: MobileAuthUser;
      sessionToken: string;
      expiresAt: string;
      nextAction: "login";
    }
  | {
      ok: false;
      schemaVersion: number;
      error: string;
      code?: string;
    };

export type MobileLoginResult =
  | {
      ok: true;
      schemaVersion: number;
      user: MobileAuthUser;
      sessionToken: string;
      expiresAt: string;
    }
  | {
      ok: false;
      schemaVersion: number;
      error: string;
      code?: string;
    };

function parseAuthUser(data: Record<string, unknown>): MobileAuthUser | null {
  const user = data.user as Record<string, unknown> | undefined;
  if (!user || typeof user.id !== "string" || typeof user.email !== "string") return null;
  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" ? user.name : user.email,
  };
}

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

export async function loginMobileMember(input: MobileLoginRequest): Promise<MobileLoginResult> {
  const base = getAskBibleBaseUrl();
  const res = await fetchWithTimeout(`${base}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeoutMs: 12_000,
    body: JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      email: input.email,
      password: input.password,
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
      schemaVersion: SCHEMA_VERSION,
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
  };
}
