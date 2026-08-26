import { pullMemberProfileFromServer } from "./syncMemberProfileFromServer";
import { syncMemberReadingAfterLogin } from "../member-sync/useMemberReadingSync";
import { completeOnboardingDevotionIntro } from "../onboarding/onboarding-devotion-prefs";
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
  const user: MemberUser = synced
    ? {
        ...input.user,
        ...synced,
        createdAt: synced.createdAt ?? input.user.createdAt ?? null,
      }
    : input.user;
  await writeMemberSession({
    sessionToken: input.sessionToken,
    expiresAt: input.expiresAt,
    user,
  });
  // 登录即过欢迎页，避免 OAuth 深链先落到 / 再被 gate 打回登录页。
  await completeOnboardingDevotionIntro([]);
  try {
    await syncMemberReadingAfterLogin(input.sessionToken);
  } catch {
    // 会话已写入；同步失败不把人留在登录页。
  }
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
