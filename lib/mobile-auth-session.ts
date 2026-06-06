import { signAskbibleUserSessionCookie } from "@/lib/askbible-user-session";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export async function issueMobileUserSessionToken(user: {
  id: string;
  email: string;
  name: string;
}): Promise<{ sessionToken: string; expiresAt: string }> {
  const exp = Date.now() + SESSION_MS;
  const sessionToken = await signAskbibleUserSessionCookie({
    v: 1,
    sub: user.id,
    email: user.email,
    name: user.name,
    exp,
  });
  return { sessionToken, expiresAt: new Date(exp).toISOString() };
}
