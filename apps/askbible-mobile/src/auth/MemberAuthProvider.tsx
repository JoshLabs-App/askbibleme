import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { InteractionManager } from "react-native";
import { loginMobileMember, loginMobileMemberWithApple, loginMobileMemberWithGoogle, registerMobileMember, deleteMobileMemberAccount } from "../api/memberAuth";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { hydrateMemberRegisterEnabled, scheduleMemberRegisterEnabledRemoteHydrate } from "./member-register-enabled";
import { signInWithAppleNative } from "./appleSignIn";
import { signInWithGoogleNative } from "./googleSignIn";
import { getLocale } from "../i18n/locale-store";
import {
  clearMemberSession,
  readMemberSession,
  writeMemberSession,
  type MemberSession,
  type MemberUser,
} from "./memberSession";

type MemberAuthContextValue = {
  bootstrapped: boolean;
  user: MemberUser | null;
  signIn: (input: { email: string; password: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signInWithGoogle: () => Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }>;
  signInWithApple: () => Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  completeRegistration: (input: {
    email: string;
    password: string;
    name?: string;
    locale?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

async function verifyRemoteSession(session: MemberSession): Promise<MemberUser | null> {
  const base = getAskBibleBaseUrl();
  const res = await fetchWithTimeout(toAbsoluteUrl(base, "/api/mobile/auth/session"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.sessionToken}`,
    },
    timeoutMs: 10_000,
  });
  if (!res.ok) return session.user;
  const data = (await res.json().catch(() => null)) as {
    user?: { id?: string; email?: string; name?: string } | null;
  } | null;
  const remoteUser = data?.user;
  if (!remoteUser || typeof remoteUser.id !== "string" || typeof remoteUser.email !== "string") return null;
  return {
    id: remoteUser.id,
    email: remoteUser.email,
    name: typeof remoteUser.name === "string" ? remoteUser.name : remoteUser.email,
  };
}

async function persistSession(input: {
  sessionToken: string;
  expiresAt: string;
  user: MemberUser;
}): Promise<void> {
  await writeMemberSession({
    sessionToken: input.sessionToken,
    expiresAt: input.expiresAt,
    user: input.user,
  });
}

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<MemberUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    let verifyTask: { cancel: () => void } | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        await hydrateMemberRegisterEnabled();
        scheduleMemberRegisterEnabledRemoteHydrate();
        const local = await readMemberSession();
        if (cancelled) return;
        if (!local) {
          setBootstrapped(true);
          return;
        }
        setUser(local.user);
        setBootstrapped(true);
        if (!isMobileOfflineFirst()) {
          verifyTask = InteractionManager.runAfterInteractions(() => {
            void (async () => {
              if (cancelled || !(await isNetworkAvailable())) return;
              try {
                const remote = await verifyRemoteSession(local);
                if (cancelled) return;
                if (!remote) {
                  await clearMemberSession();
                  setUser(null);
                } else {
                  setUser(remote);
                }
              } catch {
                // keep local session when offline/unreachable
              }
            })();
          });
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
      verifyTask?.cancel();
    };
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    if (isMobileBundledOnly()) {
      return { ok: false as const, error: "network" };
    }
    try {
      const result = await loginMobileMember(input);
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }
      await persistSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(result.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network" };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isMobileBundledOnly()) {
      return { ok: false as const, error: "network" };
    }
    const native = await signInWithGoogleNative();
    if (!native.ok) {
      if (native.code === "google_cancelled") {
        return { ok: false as const, error: "cancelled", cancelled: true };
      }
      return { ok: false as const, error: native.error || "google_failed" };
    }
    try {
      const result = await loginMobileMemberWithGoogle({
        idToken: native.idToken,
        locale: getLocale(),
      });
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }
      await persistSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(result.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network" };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    if (isMobileBundledOnly()) {
      return { ok: false as const, error: "network" };
    }
    const native = await signInWithAppleNative();
    if (!native.ok) {
      if (native.code === "apple_cancelled") {
        return { ok: false as const, error: "cancelled", cancelled: true };
      }
      return { ok: false as const, error: native.error || "apple_failed" };
    }
    try {
      const result = await loginMobileMemberWithApple({
        idToken: native.idToken,
        nonce: native.nonce,
        locale: getLocale(),
        displayName: native.displayName,
      });
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }
      await persistSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(result.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network" };
    }
  }, []);

  const completeRegistration = useCallback(
    async (input: { email: string; password: string; name?: string; locale?: string }) => {
      if (isMobileBundledOnly()) {
        return { ok: false as const, error: "network" };
      }
      try {
        const result = await registerMobileMember(input);
        if (!result.ok) {
          return { ok: false as const, error: result.error };
        }
        if (!result.sessionToken || !result.expiresAt) {
          return { ok: false as const, error: "invalid_response" };
        }
        await persistSession({
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          user: result.user,
        });
        setUser(result.user);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "network" };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await clearMemberSession();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isMobileBundledOnly()) {
      return { ok: false as const, error: "network", code: "network" };
    }
    try {
      const result = await deleteMobileMemberAccount();
      if (!result.ok) {
        return {
          ok: false as const,
          error: result.error,
          code: result.code,
        };
      }
      await clearMemberSession();
      setUser(null);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network", code: "network" };
    }
  }, []);

  const value = useMemo(
    () => ({ bootstrapped, user, signIn, signInWithGoogle, signInWithApple, signOut, deleteAccount, completeRegistration }),
    [bootstrapped, user, signIn, signInWithGoogle, signInWithApple, signOut, deleteAccount, completeRegistration],
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth(): MemberAuthContextValue {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
