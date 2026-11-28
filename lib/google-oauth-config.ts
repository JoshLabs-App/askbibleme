/** Google OAuth 2.0 Web client ID (verified directly via JWKS in askbible-sync). Used by native sign-in. */
export function getGoogleWebClientId(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    process.env.GOOGLE_WEB_CLIENT_ID?.trim() ||
    ""
  );
}

export function isGoogleWebClientIdConfigured(): boolean {
  return Boolean(getGoogleWebClientId());
}
