import { cookies } from "next/headers";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { getAskbibleUserById } from "@/lib/askbible-user-sqlite";
import {
  ASKBIBLE_USER_SESSION_COOKIE,
  parseAskbibleUserSessionCookie,
} from "@/lib/askbible-user-session";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchAskbibleProfile,
  getAskbibleUserFromAccessToken,
  isLikelySupabaseAccessToken,
  toAskbibleAuthUser,
} from "@/lib/askbible-supabase-auth";

export type MemberIdentity = {
  id: string;
  email: string;
  name: string;
};

export function readMemberSessionToken(req: Request): string {
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return req.headers.get("x-askbible-session")?.trim() ?? "";
}

async function resolveIdentityFromBearerToken(token: string): Promise<MemberIdentity | null> {
  if (!token) return null;

  if (isSupabaseAuthConfigured() && isLikelySupabaseAccessToken(token)) {
    const user = await getAskbibleUserFromAccessToken(token);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return null;
  const session = await parseAskbibleUserSessionCookie(token);
  if (!session) return null;
  const user = await getAskbibleUserById(dbPath, session.sub);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

async function resolveIdentityFromWebCookies(): Promise<MemberIdentity | null> {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        const profile = await fetchAskbibleProfile(supabase, data.user.id);
        const user = toAskbibleAuthUser(data.user, profile);
        return { id: user.id, email: user.email, name: user.name };
      }
    }
  }

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return null;
  const store = await cookies();
  const sessionCookie = store.get(ASKBIBLE_USER_SESSION_COOKIE)?.value;
  const session = await parseAskbibleUserSessionCookie(sessionCookie);
  if (!session) return null;
  const user = await getAskbibleUserById(dbPath, session.sub);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** App Bearer token + Web cookie session */
export async function resolveMemberIdentityFromRequest(req: Request): Promise<MemberIdentity | null> {
  const fromBearer = await resolveIdentityFromBearerToken(readMemberSessionToken(req));
  if (fromBearer) return fromBearer;
  return resolveIdentityFromWebCookies();
}

/** @deprecated Use resolveMemberIdentityFromRequest */
export const resolveMobileMemberIdentity = resolveMemberIdentityFromRequest;

/** @deprecated Use readMemberSessionToken */
export const readMobileSessionToken = readMemberSessionToken;

export type MobileMemberIdentity = MemberIdentity;
