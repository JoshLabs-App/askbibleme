"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AskbibleAppUser = { id: string; email: string; name: string };

type Ctx = {
  /** 是否已完成首次用户态拉取 */
  bootstrapped: boolean;
  configured: boolean;
  user: AskbibleAppUser | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
};

const AskbibleUserContext = createContext<Ctx | null>(null);

export function AskbibleUserProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [user, setUser] = useState<AskbibleAppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/askbible", { method: "GET", cache: "no-store" });
      if (!res.ok) {
        setConfigured(false);
        setUser(null);
        setIsAdmin(false);
        return;
      }
      const data = (await res.json()) as {
        configured?: boolean;
        user?: AskbibleAppUser | null;
        isAdmin?: boolean;
      };
      setConfigured(Boolean(data.configured));
      setUser(data.user || null);
      setIsAdmin(Boolean(data.isAdmin));
    } catch {
      setConfigured(false);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
      setBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/askbible", { method: "DELETE" });
    } finally {
      await refresh();
    }
  }, [refresh]);

  const deleteAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/askbible/account", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        code?: string;
      } | null;
      if (!res.ok || data?.ok !== true) {
        return {
          ok: false as const,
          error: typeof data?.error === "string" ? data.error : "delete_failed",
          code: typeof data?.code === "string" ? data.code : undefined,
        };
      }
      await refresh();
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network", code: "network" };
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ bootstrapped, configured, user, isAdmin, loading, refresh, logout, deleteAccount }),
    [bootstrapped, configured, user, isAdmin, loading, refresh, logout, deleteAccount],
  );

  return <AskbibleUserContext.Provider value={value}>{children}</AskbibleUserContext.Provider>;
}

export function useAskbibleUser(): Ctx {
  const ctx = useContext(AskbibleUserContext);
  if (!ctx) {
    throw new Error("useAskbibleUser must be used within AskbibleUserProvider");
  }
  return ctx;
}
