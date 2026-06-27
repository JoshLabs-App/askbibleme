type OAuthProvider = "google" | "apple";

type OAuthFailure = {
  error?: string;
  code?: string;
  cancelled?: boolean;
};

function isNetworkErrorMessage(msg: string): boolean {
  return /network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect/i.test(
    msg,
  );
}

/** Map native/API OAuth failures to localized copy (never show Google text for Apple). */
export function resolveMemberOAuthError(
  provider: OAuthProvider,
  t: (path: string) => string,
  result: OAuthFailure,
): string | null {
  if (result.cancelled) return null;

  if (result.error === "network" || result.code === "network") {
    return t("auth.errorNetwork");
  }

  const code = (result.code ?? result.error ?? "").trim();
  const message = (result.error ?? "").trim();

  if (provider === "google") {
    if (code === "google_not_configured") return t("auth.errorOAuthGoogleNotConfigured");
    if (code === "google_android_setup") {
      return t("auth.errorOAuthGoogleNotConfigured");
    }
    if (code === "google_play_services") {
      return t("auth.errorOAuthGoogle");
    }
    if (code === "auth_disabled") {
      return message && !message.startsWith("google_") ? message : t("auth.registerClosed");
    }
    if (code === "google_auth_failed" && message && !message.startsWith("google_")) return message;
    if (isNetworkErrorMessage(message)) {
      return t("auth.errorNetwork");
    }
    if (/redirect|invalid.*url|not allowed/i.test(message)) {
      return t("auth.errorOAuthGoogleNotConfigured");
    }
    if (message.includes("Google") || message.includes("谷歌")) return message;
    if (message && message !== "google_failed" && !message.startsWith("google_")) return message;
    return t("auth.errorOAuthGoogle");
  }

  if (code === "apple_not_configured") return t("auth.errorOAuthAppleNotConfigured");
  if (/audience|client_id|client id|bundle/i.test(message)) {
    return t("auth.errorOAuthAppleNotConfigured");
  }
  if (code === "auth_disabled") {
    return message && !message.startsWith("apple_") ? message : t("auth.registerClosed");
  }
  if (code === "apple_auth_failed" && message && !message.startsWith("apple_")) return message;
  if (
    message.includes("Apple") ||
    message.includes("苹果") ||
    code.startsWith("apple_")
  ) {
    if (message && !message.startsWith("apple_")) return message;
    return t("auth.errorOAuthApple");
  }

  return t("auth.errorOAuthApple");
}
