import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { logAuthApiTarget, parseAuthUser, SCHEMA_VERSION } from "./memberAuthShared";
import type { MobileLoginRequest, MobileLoginResult } from "./memberAuthTypes";

export async function loginMobileMember(input: MobileLoginRequest & { locale?: string }): Promise<MobileLoginResult> {
  const base = getAskBibleBaseUrl();
  const res = await fetchWithTimeout(`${base}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeoutMs: 12_000,
    body: JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      email: input.email,
      password: input.password,
      locale: input.locale ?? "",
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
  };
}

export async function loginMobileMemberWithGoogleAt(
  baseUrl: string,
  input: {
    idToken: string;
    locale?: string;
  },
): Promise<MobileLoginResult> {
  const base = baseUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/api/mobile/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      timeoutMs: 12_000,
      body: JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        idToken: input.idToken,
        locale: input.locale ?? "",
      }),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[memberAuth] Google login fetch failed", base, err);
    }
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "network",
      code: "network",
    };
  }

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
  };
}

export async function loginMobileMemberWithGoogle(input: {
  idToken: string;
  locale?: string;
}): Promise<MobileLoginResult> {
  logAuthApiTarget("Google login");
  return loginMobileMemberWithGoogleAt(getAskBibleBaseUrl(), input);
}

export async function loginMobileMemberWithAppleAt(
  baseUrl: string,
  input: {
    idToken: string;
    nonce: string;
    locale?: string;
    displayName?: string;
  },
): Promise<MobileLoginResult> {
  const base = baseUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetchWithTimeout(`${base}/api/mobile/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      timeoutMs: 12_000,
      body: JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        idToken: input.idToken,
        nonce: input.nonce,
        locale: input.locale ?? "",
        displayName: input.displayName ?? "",
      }),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[memberAuth] Apple login fetch failed", base, err);
    }
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "network",
      code: "network",
    };
  }

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
  };
}

export async function loginMobileMemberWithApple(input: {
  idToken: string;
  nonce: string;
  locale?: string;
  displayName?: string;
}): Promise<MobileLoginResult> {
  logAuthApiTarget("Apple login");
  return loginMobileMemberWithAppleAt(getAskBibleBaseUrl(), input);
}
