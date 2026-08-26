import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible.mobile.member-session.v1";

export type MemberUser = {
  id: string;
  email: string;
  name: string;
  locale?: string | null;
  /** 账号注册时间（ISO） */
  createdAt?: string | null;
};

type StoredMemberSession = {
  sessionToken: string;
  expiresAt: string;
  user: MemberUser;
};

export type MemberSession = StoredMemberSession;

export async function readMemberSession(): Promise<MemberSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMemberSession>;
    if (
      !parsed ||
      typeof parsed.sessionToken !== "string" ||
      !parsed.sessionToken.trim() ||
      typeof parsed.expiresAt !== "string" ||
      !parsed.user ||
      typeof parsed.user.id !== "string" ||
      typeof parsed.user.email !== "string"
    ) {
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      await clearMemberSession();
      return null;
    }
    return {
      sessionToken: parsed.sessionToken.trim(),
      expiresAt: parsed.expiresAt,
      user: {
        id: parsed.user.id,
        email: parsed.user.email,
        name: typeof parsed.user.name === "string" ? parsed.user.name : parsed.user.email,
        createdAt:
          typeof parsed.user.createdAt === "string" && parsed.user.createdAt.trim()
            ? parsed.user.createdAt.trim()
            : null,
      },
    };
  } catch {
    return null;
  }
}

export async function writeMemberSession(session: MemberSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearMemberSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
