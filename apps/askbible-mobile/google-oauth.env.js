/** Shared Google OAuth env resolution for app.config.js (build time). */

function trimEnv(name) {
  const value = process.env[name]?.trim();
  return value || "";
}

function reverseClientScheme(clientId) {
  if (!clientId) return "";
  const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/i, "");
  return prefix ? `com.googleusercontent.apps.${prefix}` : "";
}

function resolveGoogleOAuthEnv() {
  const webClientId =
    trimEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID") ||
    trimEnv("NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID") ||
    trimEnv("GOOGLE_OAUTH_WEB_CLIENT_ID") ||
    trimEnv("GOOGLE_WEB_CLIENT_ID");

  const iosClientId = trimEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID");
  const androidClientId = trimEnv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID");

  const iosUrlScheme =
    trimEnv("EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME") ||
    reverseClientScheme(iosClientId) ||
    reverseClientScheme(androidClientId);

  return {
    webClientId,
    iosClientId,
    androidClientId,
    iosUrlScheme,
    configured: Boolean(webClientId),
  };
}

module.exports = {
  resolveGoogleOAuthEnv,
  reverseClientScheme,
};
