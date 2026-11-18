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
  signOutAskbibleWeb,
  type AskbibleWebUser,
} from "@/lib/askbible-web-auth-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { discardMemberReadingOwnerArchiveWeb, handleMemberReadingAuthChangeWeb } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

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
      setConfigured(false);
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
    const listener = createSupabaseBrowserClient()?.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      refreshGeneration.current += 1;
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        authGeneration.current += 1;
        handleMemberReadingAuthChangeWeb(session?.user.id ?? null, event === "INITIAL_SESSION");
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setIsAdmin(false);
      }
      // Supabase holds an auth lock inside this callback; refresh after it returns.
      queueMicrotask(() => { if (mounted) void refresh(); });
    });
    void refresh();
    return () => {
      mounted = false;
      refreshGeneration.current += 1;
      listener?.data.subscription.unsubscribe();
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    const generation = authGeneration.current;
    try {
      const { flushMemberReadingSyncWebNow } = await import(
        "@/lib/member-reading-sync/client/run-member-reading-sync-web"
      );
      // An unavailable sync service must not trap the user in a signed-in state.
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          flushMemberReadingSyncWebNow("sign-out"),
          new Promise<void>((resolve) => { timeout = setTimeout(resolve, 12_000); }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      const current = await createSupabaseBrowserClient()?.auth.getSession();
      if (generation !== authGeneration.current || current?.data.session?.user.id !== user?.id) return;
      await signOutAskbibleWeb(user?.id);
    } finally {
      await refresh();
    }
  }, [refresh, user?.id]);

  const deleteAccount = useCallback(async () => {
    const result = await deleteAskbibleWebAccount();
    if (result.ok) {
      if (user?.id) discardMemberReadingOwnerArchiveWeb(user.id);
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
