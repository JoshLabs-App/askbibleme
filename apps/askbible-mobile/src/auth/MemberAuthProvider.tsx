import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { InteractionManager, Linking } from "react-native";
import { loginMobileMember, loginMobileMemberWithGoogle, registerMobileMember, deleteMobileMemberAccount } from "../api/memberAuth";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { hydrateMemberRegisterEnabled, scheduleMemberRegisterEnabledRemoteHydrate } from "./member-register-enabled";
import { signInWithAppleNative } from "./appleSignIn";
import { exchangeAppleNativeCredential } from "./appleSignInExchange";
import { signInWithGoogleMobile } from "./googleSignIn";
import { handleGoogleOAuthDeepLink } from "./googleOAuthDeepLink";
import { installGoogleOAuthLinkingCapture } from "./googleOAuthLinking";
import { isGoogleOAuthCallbackUrl } from "./googleOAuthSession";
import { syncMemberReadingAfterLogin } from "../member-sync/useMemberReadingSync";
import { pullMemberProfileFromServer } from "./syncMemberProfileFromServer";
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
  syncSessionFromStorage: () => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signInWithGoogle: () => Promise<{ ok: true } | { ok: false; error: string; code?: string; cancelled?: boolean }>;
  signInWithApple: () => Promise<{ ok: true } | { ok: false; error: string; code?: string; cancelled?: boolean }>;
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

installGoogleOAuthLinkingCapture();

async function verifyRemoteSession(session: MemberSession): Promise<MemberUser | null> {
  const synced = await pullMemberProfileFromServer(session.sessionToken);
  return synced;
}

async function commitMemberSession(input: {
  sessionToken: string;
  expiresAt: string;
  user: MemberUser;
}): Promise<MemberUser> {
  const synced = await pullMemberProfileFromServer(input.sessionToken);
  const user = synced ?? input.user;
  await writeMemberSession({
    sessionToken: input.sessionToken,
    expiresAt: input.expiresAt,
    user,
  });
  void syncMemberReadingAfterLogin(input.sessionToken);
  return user;
}

async function dismissOAuthBrowserQuietly(): Promise<void> {
  try {
    const WebBrowser = await import("expo-web-browser");
    WebBrowser.dismissBrowser?.();
  } catch {
    // optional
  }
}

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<MemberUser | null>(null);

  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      void (async () => {
        const outcome = await handleGoogleOAuthDeepLink(url);
        if (!outcome.handled) return;
        void dismissOAuthBrowserQuietly();
        if (!outcome.result.ok) {
          if (outcome.result.code === "pending_handoff") return;
          if (__DEV__) {
            console.warn("[MemberAuthProvider] deep link oauth", outcome.result.error, url);
          }
          return;
        }
        try {
          const user = await commitMemberSession({
            sessionToken: outcome.result.sessionToken,
            expiresAt: outcome.result.expiresAt,
            user: outcome.result.user,
          });
          setUser(user);
        } catch (error) {
          if (__DEV__) {
            console.warn("[MemberAuthProvider] commitMemberSession from deep link", error);
          }
        }
      })();
    };
    const sub = Linking.addEventListener("url", onUrl);
    void Linking.getInitialURL().then((initial) => {
      if (!initial) return;
      // 冷启动时 Android 可能仍带着上次 OAuth 深链；+native-intent 已回首页，勿再换码/改栈
      if (isGoogleOAuthCallbackUrl(initial)) return;
      onUrl({ url: initial });
    });
    return () => sub.remove();
  }, []);

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
                  await writeMemberSession({
                    sessionToken: local.sessionToken,
                    expiresAt: local.expiresAt,
                    user: remote,
                  });
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

  const syncSessionFromStorage = useCallback(async () => {
    const local = await readMemberSession();
    setUser(local?.user ?? null);
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    try {
      const result = await loginMobileMember({ ...input, locale: getLocale() });
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }
      const user = await commitMemberSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network" };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    let result: Awaited<ReturnType<typeof signInWithGoogleMobile>>;
    try {
      result = await signInWithGoogleMobile();
    } catch (err) {
      if (__DEV__) {
        console.warn("[MemberAuthProvider] signInWithGoogleMobile threw", err);
      }
      return { ok: false as const, error: "network", code: "network" };
    }
    if (!result.ok) {
      if (result.code === "google_cancelled") {
        return { ok: false as const, error: "cancelled", cancelled: true };
      }
      const existing = await readMemberSession();
      if (existing?.sessionToken) {
        setUser(existing.user);
        return { ok: true as const };
      }
      return { ok: false as const, error: result.error || "google_failed", code: result.code ?? result.error };
    }

    if (result.kind === "session") {
      try {
        const user = await commitMemberSession({
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          user: result.user,
        });
        setUser(user);
        return { ok: true as const };
      } catch (persistError) {
        if (__DEV__) {
          console.warn("[MemberAuthProvider] commitMemberSession after Google OAuth", persistError);
        }
        return { ok: false as const, error: "session_save_failed", code: "session_save_failed" };
      }
    }

    // 兼容旧 bundle：idToken 仍走服务端（googleSignIn 新版已在内层完成 exchange）。
    try {
      const apiResult = await loginMobileMemberWithGoogle({
        idToken: result.idToken,
        locale: getLocale(),
      });
      if (!apiResult.ok) {
        return { ok: false as const, error: apiResult.error, code: apiResult.code };
      }
      const user = await commitMemberSession({
        sessionToken: apiResult.sessionToken,
        expiresAt: apiResult.expiresAt,
        user: apiResult.user,
      });
      setUser(user);
      return { ok: true as const };
    } catch (apiError) {
      if (__DEV__) {
        console.warn("[MemberAuthProvider] loginMobileMemberWithGoogle", apiError);
      }
      return { ok: false as const, error: "network", code: "network" };
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    const native = await signInWithAppleNative();
    if (!native.ok) {
      if (native.code === "apple_cancelled") {
        return { ok: false as const, error: "cancelled", cancelled: true };
      }
      return { ok: false as const, error: native.error || "apple_failed", code: native.code ?? native.error };
    }
    try {
      const result = await exchangeAppleNativeCredential({
        idToken: native.idToken,
        nonce: native.nonce,
        displayName: native.displayName,
      });
      if (!result.ok) {
        if (__DEV__) {
          console.warn("[MemberAuthProvider] Apple exchange failed", result.code, result.error);
        }
        return { ok: false as const, error: result.error, code: result.code };
      }
      const user = await commitMemberSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(user);
      return { ok: true as const };
    } catch (error) {
      if (__DEV__) {
        console.warn("[MemberAuthProvider] exchangeAppleNativeCredential", error);
      }
      return { ok: false as const, error: "network", code: "network" };
    }
  }, []);

  const completeRegistration = useCallback(
    async (input: { email: string; password: string; name?: string; locale?: string }) => {
      try {
        const result = await registerMobileMember(input);
        if (!result.ok) {
          return { ok: false as const, error: result.error };
        }
        if (!result.sessionToken || !result.expiresAt) {
          return { ok: false as const, error: "invalid_response" };
        }
        const user = await commitMemberSession({
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          user: result.user,
        });
        setUser(user);
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
    () => ({ bootstrapped, user, syncSessionFromStorage, signIn, signInWithGoogle, signInWithApple, signOut, deleteAccount, completeRegistration }),
    [bootstrapped, user, syncSessionFromStorage, signIn, signInWithGoogle, signInWithApple, signOut, deleteAccount, completeRegistration],
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth(): MemberAuthContextValue {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
