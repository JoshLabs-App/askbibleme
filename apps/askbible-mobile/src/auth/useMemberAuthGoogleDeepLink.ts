import { useEffect } from "react";
import { Linking } from "react-native";
import { handleGoogleOAuthDeepLink } from "./googleOAuthDeepLink";
import { installGoogleOAuthLinkingCapture } from "./googleOAuthLinking";
import { isGoogleOAuthCallbackUrl } from "./googleOAuthSession";
import type { MemberUser } from "./memberSession";
import { commitMemberSession, dismissOAuthBrowserQuietly } from "./memberAuthSessionCommit";

installGoogleOAuthLinkingCapture();

export function useMemberAuthGoogleDeepLink(setUser: (user: MemberUser) => void): void {
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
          const nextUser = await commitMemberSession({
            sessionToken: outcome.result.sessionToken,
            expiresAt: outcome.result.expiresAt,
            user: outcome.result.user,
          });
          setUser(nextUser);
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
      if (isGoogleOAuthCallbackUrl(initial)) return;
      onUrl({ url: initial });
    });
    return () => sub.remove();
  }, [setUser]);
}
