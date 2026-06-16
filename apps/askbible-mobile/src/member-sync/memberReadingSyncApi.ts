import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import {
  MEMBER_READING_SYNC_META_KEY,
  MEMBER_READING_SYNC_SCHEMA_VERSION,
  type MemberReadingSyncMeta,
  type MemberReadingSyncPushV1,
  type MemberReadingSyncResponseV1,
} from "./schema";

export async function readMemberReadingSyncMeta(): Promise<MemberReadingSyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(MEMBER_READING_SYNC_META_KEY);
    if (!raw) return { revision: null, lastSyncedAt: null };
    const parsed = JSON.parse(raw) as Partial<MemberReadingSyncMeta>;
    return {
      revision: typeof parsed.revision === "string" ? parsed.revision : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return { revision: null, lastSyncedAt: null };
  }
}

export async function writeMemberReadingSyncMeta(meta: MemberReadingSyncMeta): Promise<void> {
  await AsyncStorage.setItem(MEMBER_READING_SYNC_META_KEY, JSON.stringify(meta));
}

async function memberReadingSyncFetch(
  sessionToken: string,
  init: RequestInit,
): Promise<MemberReadingSyncResponseV1 | null> {
  const base = getAskBibleBaseUrl();
  try {
    const res = await fetchWithTimeout(toAbsoluteUrl(base, "/api/member/reading-sync"), {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
        ...(init.headers ?? {}),
      },
      timeoutMs: 15_000,
    });
    const data = (await res.json().catch(() => null)) as MemberReadingSyncResponseV1 | null;
    if (!data || data.schemaVersion !== MEMBER_READING_SYNC_SCHEMA_VERSION) return null;
    if (!res.ok || !data.ok) return data;
    return data;
  } catch (err) {
    if (__DEV__) {
      console.warn("[memberReadingSync] fetch failed", base, err);
    }
    return null;
  }
}

export async function pullMemberReadingSync(
  sessionToken: string,
): Promise<MemberReadingSyncResponseV1 | null> {
  return memberReadingSyncFetch(sessionToken, { method: "GET" });
}

export async function pushMemberReadingSync(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncResponseV1 | null> {
  return memberReadingSyncFetch(sessionToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(push),
  });
}
