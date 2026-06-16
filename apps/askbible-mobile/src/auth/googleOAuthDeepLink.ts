import { exchangeOAuthCallbackOnce } from "./googleOAuthExchange";
import { isGoogleOAuthCallbackUrl, type GoogleOAuthSessionResult } from "./googleOAuthSession";
import { deliverGoogleOAuthCallback, hasPendingGoogleOAuthCallback } from "./googleOAuthPending";

export type GoogleOAuthDeepLinkOutcome =
  | { handled: true; result: GoogleOAuthSessionResult }
  | { handled: false };

/** Deliver callback to in-flight OAuth, then exchange code once (shared with browser flow). */
export async function handleGoogleOAuthDeepLink(url: string): Promise<GoogleOAuthDeepLinkOutcome> {
  if (!isGoogleOAuthCallbackUrl(url)) {
    return { handled: false };
  }

  if (hasPendingGoogleOAuthCallback()) {
    deliverGoogleOAuthCallback(url);
    return { handled: true, result: { ok: false, error: "pending_handoff", code: "pending_handoff" } };
  }

  const result = await exchangeOAuthCallbackOnce(url);
  return { handled: true, result };
}
