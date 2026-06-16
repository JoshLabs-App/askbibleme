import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";

function logAuthApiTarget(label: string): void {
  if (!__DEV__) return;
  console.warn(`[memberAuth] ${label} → ${getAskBibleBaseUrl()}`);
}
import { fetchWithTimeout } from "./fetchWithTimeout";
import { readMemberSession } from "../auth/memberSession";

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

type MobileAuthUser = { id: string; email: string; name: string; locale?: string | null };

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

export type MobileDeleteAccountResult =
  | { ok: true; schemaVersion: number }
  | { ok: false; schemaVersion: number; error: string; code?: string };

function parseAuthUser(data: Record<string, unknown>): MobileAuthUser | null {
  const user = data.user as Record<string, unknown> | undefined;
  if (!user || typeof user.id !== "string" || typeof user.email !== "string") return null;
  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" ? user.name : user.email,
    locale: typeof user.locale === "string" ? user.locale : user.locale === null ? null : undefined,
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

/** 线上 HTTPS — Android 真机 Debug 时 RN→Mac HTTP 不可靠，Google idToken 交换走此地址。 */
export const MOBILE_AUTH_PRODUCTION_BASE_URL = "https://askbible.me";

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
