export function getGoogleWebClientId(): string | null {
  const value = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  return value || null;
}

export function getGoogleIosClientId(): string | null {
  const value = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  return value || null;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(getGoogleWebClientId());
}
