"use client";

import { endpointBase } from "@/lib/endpoints";

export type AskbibleWebUser = {
  id: string;
  email: string;
  name: string;
  locale?: string | null;
  isAdmin: boolean;
  createdAt: string | null;
};

export type AskbibleWebSession = {
  sessionToken: string;
  expiresAt: string;
  user: AskbibleWebUser;
};

const SESSION_STORAGE_KEY = "askbible.web.member-session.v2";
const DEVICE_ID_KEY = "askbible.web.device-id.v1";

let memorySession: AskbibleWebSession | null = null;
const authListeners = new Set<(event: "SIGNED_IN" | "SIGNED_OUT", session: AskbibleWebSession | null) => void>();

function syncApiBase(): string {
  return endpointBase("api").replace(/\/+$/, "");
}

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return "web-ephemeral";
  }
}

export function readStoredAskbibleWebSession(): AskbibleWebSession | null {
  if (memorySession) return memorySession;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AskbibleWebSession> | null;
    if (!parsed?.sessionToken || !parsed.user?.id || !parsed.user?.email) return null;
    const expMs = Date.parse(parsed.expiresAt || "");
    if (Number.isFinite(expMs) && expMs <= Date.now()) {
      clearStoredAskbibleWebSession(false);
      return null;
    }
    return {
      sessionToken: parsed.sessionToken,
      expiresAt: parsed.expiresAt || new Date(Date.now() + 86400_000).toISOString(),
      user: {
        id: parsed.user.id,
        email: parsed.user.email,
        name: parsed.user.name || parsed.user.email.split("@")[0] || parsed.user.email,
        locale: parsed.user.locale ?? null,
        isAdmin: Boolean(parsed.user.isAdmin),
        createdAt: parsed.user.createdAt ?? null,
      },
    };
  } catch {
    return null;
  }
}

function writeStoredAskbibleWebSession(session: AskbibleWebSession, emit = true): void {
  memorySession = session;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Keep in-memory session when browser storage quota is full
    }
  }
  if (emit) {
    authListeners.forEach((fn) => fn("SIGNED_IN", session));
  }
}

function clearStoredAskbibleWebSession(emit = true): void {
  memorySession = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  if (emit) {
    authListeners.forEach((fn) => fn("SIGNED_OUT", null));
  }
}

export function subscribeAskbibleWebAuth(
  fn: (event: "SIGNED_IN" | "SIGNED_OUT", session: AskbibleWebSession | null) => void,
): () => void {
  authListeners.add(fn);
  return () => {
    authListeners.delete(fn);
  };
}

export async function fetchAskbibleWebSessionUser(): Promise<{
  configured: boolean;
  user: AskbibleWebUser | null;
}> {
  const stored = readStoredAskbibleWebSession();
  if (!stored) {
    return { configured: true, user: null };
  }

  try {
    const res = await fetch(`${syncApiBase()}/v1/auth/session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stored.sessionToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      // Only clear if the active stored token hasn't been replaced by a newer login while in flight
      if (readStoredAskbibleWebSession()?.sessionToken === stored.sessionToken) {
        clearStoredAskbibleWebSession(true);
      }
      return { configured: true, user: null };
    }

    if (!res.ok) {
      // Transient 429 / 5xx network hiccup: keep cached local session alive
      return { configured: true, user: stored.user };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      expiresAt?: string;
      user?: AskbibleWebUser;
    };
    if (!data?.ok || !data.user?.id) {
      return { configured: true, user: stored.user };
    }
    const updated: AskbibleWebSession = {
      sessionToken: stored.sessionToken,
      expiresAt: data.expiresAt || stored.expiresAt,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || stored.user.name,
        locale: data.user.locale ?? stored.user.locale ?? null,
        isAdmin: Boolean(data.user.isAdmin),
        createdAt: data.user.createdAt ?? stored.user.createdAt ?? null,
      },
    };
    if (readStoredAskbibleWebSession()?.sessionToken === stored.sessionToken) {
      writeStoredAskbibleWebSession(updated, false);
    }
    return { configured: true, user: updated.user };
  } catch {
    // Offline or DNS issue: keep local session so user stays signed in offline
    return { configured: true, user: stored.user };
  }
}

export async function signInAskbibleWebWithOtp(
  email: string,
  locale?: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "invalid_email", status: 400 };
  }
  try {
    const res = await fetch(`${syncApiBase()}/v1/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: trimmed, locale }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      code?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.code === "invalid_email" ? "invalid_email" : data.error || "otp_send_failed",
        status: res.status,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function verifyAskbibleWebOtp(input: {
  email: string;
  token: string;
  locale?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const email = input.email.trim().toLowerCase();
  const code = input.token.trim().replace(/\D/g, "");
  if (!email || code.length !== 6) {
    return { ok: false, error: "invalid_otp", status: 400 };
  }
  try {
    const res = await fetch(`${syncApiBase()}/v1/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email,
        code,
        locale: input.locale,
        deviceId: getOrCreateDeviceId(),
        deviceName: typeof navigator !== "undefined" ? navigator.platform || "Browser" : "Browser",
        platform: "web",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      sessionToken?: string;
      expiresAt?: string;
      user?: AskbibleWebUser;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.sessionToken || !data.user?.id) {
      return { ok: false, error: data.error || "invalid_otp", status: res.status };
    }
    writeStoredAskbibleWebSession({
      sessionToken: data.sessionToken,
      expiresAt: data.expiresAt || new Date(Date.now() + 365 * 86400_000).toISOString(),
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || data.user.email.split("@")[0] || data.user.email,
        locale: data.user.locale ?? null,
        isAdmin: Boolean(data.user.isAdmin),
        createdAt: data.user.createdAt ?? null,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function updateAskbibleWebProfile(input: {
  name?: string;
  locale?: string;
}): Promise<{ ok: true; user: AskbibleWebUser } | { ok: false; error: string }> {
  const stored = readStoredAskbibleWebSession();
  if (!stored) return { ok: false, error: "unauthorized" };
  try {
    const res = await fetch(`${syncApiBase()}/v1/auth/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${stored.sessionToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      user?: AskbibleWebUser;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.user) {
      return { ok: false, error: data.error || "update_failed" };
    }
    const next: AskbibleWebSession = { ...stored, user: data.user };
    writeStoredAskbibleWebSession(next, false);
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function signOutAskbibleWeb(expectedUserId?: string): Promise<void> {
  const stored = readStoredAskbibleWebSession();
  if (!stored) return;
  if (expectedUserId && stored.user.id !== expectedUserId) return;
  clearStoredAskbibleWebSession(true);
  try {
    await fetch(`${syncApiBase()}/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stored.sessionToken}` },
    });
  } catch {
    // Local session is already cleared; remote token can expire naturally
  }
}

export async function deleteAskbibleWebAccount(): Promise<
  { ok: true } | { ok: false; error: string; code?: string }
> {
  const stored = readStoredAskbibleWebSession();
  if (!stored) {
    return { ok: false, error: "未登录或登录已过期。", code: "unauthorized" };
  }
  try {
    const res = await fetch(`${syncApiBase()}/v1/auth/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${stored.sessionToken}`,
        Accept: "application/json",
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      code?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || "注销失败，请稍后重试。",
        code: data.code,
      };
    }
    if (readStoredAskbibleWebSession()?.sessionToken === stored.sessionToken) {
      clearStoredAskbibleWebSession(true);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "网络异常，未能连接服务器。", code: "network_error" };
  }
}
