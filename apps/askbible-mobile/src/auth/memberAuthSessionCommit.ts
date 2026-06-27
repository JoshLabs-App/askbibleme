import { pullMemberProfileFromServer } from "./syncMemberProfileFromServer";
import { syncMemberReadingAfterLogin } from "../member-sync/useMemberReadingSync";
import {
  writeMemberSession,
  type MemberSession,
  type MemberUser,
} from "./memberSession";

export async function verifyRemoteMemberSession(session: MemberSession): Promise<MemberUser | null> {
  return pullMemberProfileFromServer(session.sessionToken);
}

export async function commitMemberSession(input: {
  sessionToken: string;
  expiresAt: string;
  user: MemberUser;
}): Promise<MemberUser> {
  const synced = await pullMemberProfileFromServer(input.sessionToken);
  const user = synced ?? input.user;
  await writeMemberSession({
    sessionToken: input.sessionToken,
    expiresAt: input.expiresAt,
    user,
  });
  await syncMemberReadingAfterLogin(input.sessionToken);
  return user;
}

export async function dismissOAuthBrowserQuietly(): Promise<void> {
  try {
    const WebBrowser = await import("expo-web-browser");
    WebBrowser.dismissBrowser?.();
  } catch {
    // optional
  }
}
