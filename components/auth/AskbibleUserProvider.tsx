"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteAskbibleWebAccount,
  fetchAskbibleWebSessionUser,
  readStoredAskbibleWebSession,
  signOutAskbibleWeb,
  subscribeAskbibleWebAuth,
  type AskbibleWebUser,
} from "@/lib/askbible-web-auth-client";
import {
  discardMemberReadingOwnerArchiveWeb,
  handleMemberReadingAuthChangeWeb,
} from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

export type AskbibleAppUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string | null;
};

type Ctx = {
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
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState<AskbibleAppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const refreshGeneration = useRef(0);
  const authGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const session = await fetchAskbibleWebSessionUser();
      if (generation !== refreshGeneration.current) return;
      setConfigured(session.configured);
      setUser(toAppUser(session.user));
      setIsAdmin(Boolean(session.user?.isAdmin));
    } catch {
      if (generation !== refreshGeneration.current) return;
      setConfigured(true);
      setUser(null);
      setIsAdmin(false);
    } finally {
      if (generation === refreshGeneration.current) {
        setLoading(false);
        setBootstrapped(true);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initial = readStoredAskbibleWebSession();
    handleMemberReadingAuthChangeWeb(initial?.user.id ?? null, true);

    const unsubscribe = subscribeAskbibleWebAuth((event, session) => {
      refreshGeneration.current += 1;
      authGeneration.current += 1;
      handleMemberReadingAuthChangeWeb(session?.user.id ?? null, false);
      if (event === "SIGNED_OUT") {
        setUser(null);
        setIsAdmin(false);
      } else if (session?.user) {
        setUser(toAppUser(session.user));
        setIsAdmin(Boolean(session.user.isAdmin));
      }
      queueMicrotask(() => {
        if (mounted) void refresh();
      });
    });

    void refresh();
    return () => {
      mounted = false;
      refreshGeneration.current += 1;
      unsubscribe();
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    const generation = authGeneration.current;
    const targetUserId = user?.id;
    try {
      const { flushMemberReadingSyncWebNow } = await import(
        "@/lib/member-reading-sync/client/run-member-reading-sync-web"
      );
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          flushMemberReadingSyncWebNow("sign-out"),
          new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, 8_000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      const current = readStoredAskbibleWebSession();
      if (generation !== authGeneration.current || current?.user.id !== targetUserId) return;
      await signOutAskbibleWeb(targetUserId);
    } finally {
      await refresh();
    }
  }, [refresh, user?.id]);

  const deleteAccount = useCallback(async () => {
    const targetUserId = user?.id;
    const result = await deleteAskbibleWebAccount();
    if (result.ok) {
      if (targetUserId) discardMemberReadingOwnerArchiveWeb(targetUserId);
      await refresh();
    }
    return result;
  }, [refresh, user?.id]);

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
