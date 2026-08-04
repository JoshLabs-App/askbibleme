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

export type MemberReadingSyncFetchResult = {
  response: MemberReadingSyncResponseV1 | null;
  httpStatus: number | null;
};

function syncBaseUrls(primary: string): string[] {
  const normalized = primary.replace(/\/$/, "");
  return /10\.0\.2\.2|localhost|127\.0\.0\.1/.test(normalized)
    ? [normalized, "https://askbible.me"]
    : [normalized];
}

async function memberReadingSyncFetch(
  sessionToken: string,
  init: RequestInit,
): Promise<MemberReadingSyncFetchResult> {
  const base = getAskBibleBaseUrl();
  for (const requestBase of syncBaseUrls(base)) {
    try {
      const res = await fetchWithTimeout(toAbsoluteUrl(requestBase, "/api/member/reading-sync"), {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
        ...(init.headers ?? {}),
      },
      timeoutMs: 15_000,
      });
      const data = (await res.json().catch(() => null)) as MemberReadingSyncResponseV1 | null;
      if (!data || data.schemaVersion !== MEMBER_READING_SYNC_SCHEMA_VERSION) {
        return { response: null, httpStatus: res.status };
      }
      if (!res.ok || !data.ok) return { response: data, httpStatus: res.status };
      return { response: data, httpStatus: res.status };
    } catch (err) {
      if (__DEV__) {
        console.warn("[memberReadingSync] fetch failed", requestBase, err);
      }
    }
  }
  return { response: null, httpStatus: null };
}

function unwrapFetch(result: MemberReadingSyncFetchResult): MemberReadingSyncResponseV1 | null {
  return result.response;
}

export async function pullMemberReadingSync(
  sessionToken: string,
): Promise<MemberReadingSyncResponseV1 | null> {
  return unwrapFetch(await memberReadingSyncFetch(sessionToken, { method: "GET" }));
}

export async function pushMemberReadingSync(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncResponseV1 | null> {
  return unwrapFetch(
    await memberReadingSyncFetch(sessionToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(push),
    }),
  );
}

export async function pullMemberReadingSyncDetailed(
  sessionToken: string,
): Promise<MemberReadingSyncFetchResult> {
  return memberReadingSyncFetch(sessionToken, { method: "GET" });
}

export async function pushMemberReadingSyncDetailed(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncFetchResult> {
  return memberReadingSyncFetch(sessionToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(push),
  });
}
