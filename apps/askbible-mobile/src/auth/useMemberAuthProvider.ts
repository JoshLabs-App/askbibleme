import { useCallback, useMemo, useState } from "react";
import {
  deleteMobileMemberAccount,
  loginMobileMember,
  loginMobileMemberWithGoogle,
  registerMobileMember,
} from "../api/memberAuth";
import { getLocale } from "../i18n/locale-store";
import { exchangeAppleNativeCredential } from "./appleSignInExchange";
import { signInWithAppleNative } from "./appleSignIn";
import { signInWithGoogleMobile } from "./googleSignIn";
import { commitMemberSession } from "./memberAuthSessionCommit";
import { clearMemberSession, readMemberSession, type MemberUser } from "./memberSession";
import { useMemberAuthBootstrap } from "./useMemberAuthBootstrap";
import { useMemberAuthGoogleDeepLink } from "./useMemberAuthGoogleDeepLink";

export function useMemberAuthProvider() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<MemberUser | null>(null);

  useMemberAuthGoogleDeepLink(setUser);
  useMemberAuthBootstrap(setBootstrapped, setUser);

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
      const nextUser = await commitMemberSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(nextUser);
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
        const nextUser = await commitMemberSession({
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          user: result.user,
        });
        setUser(nextUser);
        return { ok: true as const };
      } catch (persistError) {
        if (__DEV__) {
          console.warn("[MemberAuthProvider] commitMemberSession after Google OAuth", persistError);
        }
        return { ok: false as const, error: "session_save_failed", code: "session_save_failed" };
      }
    }

    try {
      const apiResult = await loginMobileMemberWithGoogle({
        idToken: result.idToken,
        locale: getLocale(),
      });
      if (!apiResult.ok) {
        return { ok: false as const, error: apiResult.error, code: apiResult.code };
      }
      const nextUser = await commitMemberSession({
        sessionToken: apiResult.sessionToken,
        expiresAt: apiResult.expiresAt,
        user: apiResult.user,
      });
      setUser(nextUser);
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
      const nextUser = await commitMemberSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(nextUser);
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
        const nextUser = await commitMemberSession({
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          user: result.user,
        });
        setUser(nextUser);
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

  return useMemo(
    () => ({
      bootstrapped,
      user,
      syncSessionFromStorage,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      deleteAccount,
      completeRegistration,
    }),
    [
      bootstrapped,
      user,
      syncSessionFromStorage,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      deleteAccount,
      completeRegistration,
    ],
  );
}

export type MemberAuthContextValue = ReturnType<typeof useMemberAuthProvider>;
