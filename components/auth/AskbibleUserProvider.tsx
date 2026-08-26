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
import {
  deleteAskbibleWebAccount,
  fetchAskbibleWebSessionUser,
  signOutAskbibleWeb,
  type AskbibleWebUser,
} from "@/lib/askbible-web-auth-client";

export type AskbibleAppUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string | null;
};

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

function toAppUser(user: AskbibleWebUser | null): AskbibleAppUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export function AskbibleUserProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [user, setUser] = useState<AskbibleAppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAskbibleWebSessionUser();
      setConfigured(session.configured);
      setUser(toAppUser(session.user));
      setIsAdmin(Boolean(session.user?.isAdmin));
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
      const { flushMemberReadingSyncWebNow, markMemberReadingSyncPullOnlyWeb } = await import(
        "@/lib/member-reading-sync/client/run-member-reading-sync-web"
      );
      flushMemberReadingSyncWebNow("sign-out");
      await markMemberReadingSyncPullOnlyWeb();
      await signOutAskbibleWeb();
    } finally {
      await refresh();
    }
  }, [refresh]);

  const deleteAccount = useCallback(async () => {
    const result = await deleteAskbibleWebAccount();
    if (result.ok) await refresh();
    return result;
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
