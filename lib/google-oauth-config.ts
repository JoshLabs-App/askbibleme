/** Google OAuth 2.0 Web client ID (same as Supabase Google provider). Used by native sign-in. */
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
