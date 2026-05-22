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
      const data = (await res.json()) as { configured?: boolean; user?: AskbibleAppUser | null };
      setConfigured(Boolean(data.configured));
      setUser(data.user || null);
      setIsAdmin(false);
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

  const value = useMemo(
    () => ({ bootstrapped, configured, user, isAdmin, loading, refresh, logout }),
    [bootstrapped, configured, user, isAdmin, loading, refresh, logout],
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
