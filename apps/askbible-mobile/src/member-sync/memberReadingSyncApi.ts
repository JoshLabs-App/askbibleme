import AsyncStorage from "@react-native-async-storage/async-storage";
import { logSwallowedError } from "../debug/logSwallowedError";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isSupabaseAuthConfigured } from "../config/supabaseAuth";
import {
  createAuthedMobileSupabaseClient,
  isLikelySupabaseAccessToken,
} from "../auth/supabaseMemberAuth";
import {
  mergeMemberReadingSyncDocuments,
  type MemberReadingSyncDocumentV1,
} from "./mergeReadingBlobs";
import {
  MEMBER_READING_SYNC_META_KEY,
  MEMBER_READING_SYNC_SCHEMA_VERSION,
  type MemberReadingSyncMeta,
  type MemberReadingSyncPushV1,
  type MemberReadingSyncResponseV1,
} from "./schema";

const TABLE = "member_reading_sync_documents";

export async function readMemberReadingSyncMeta(): Promise<MemberReadingSyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(MEMBER_READING_SYNC_META_KEY);
    if (!raw) {
      return { revision: null, lastSyncedAt: null, boundUserId: null, requirePullOnly: false, lastError: null };
    }
    const parsed = JSON.parse(raw) as Partial<MemberReadingSyncMeta>;
    return {
      revision: typeof parsed.revision === "string" ? parsed.revision : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      boundUserId: typeof parsed.boundUserId === "string" && parsed.boundUserId.trim()
        ? parsed.boundUserId.trim()
        : null,
      requirePullOnly: parsed.requirePullOnly === true,
      lastError: typeof parsed.lastError === "string" && parsed.lastError.trim()
        ? parsed.lastError.trim()
        : null,
    };
  } catch (error) {
    logSwallowedError("memberReadingSyncApi.readMemberReadingSyncMeta", error);
    return { revision: null, lastSyncedAt: null, boundUserId: null, requirePullOnly: false, lastError: null };
  }
}

export async function writeMemberReadingSyncMeta(meta: MemberReadingSyncMeta): Promise<void> {
  await AsyncStorage.setItem(MEMBER_READING_SYNC_META_KEY, JSON.stringify(meta));
}

export async function rememberMemberReadingSyncError(error: string | null): Promise<void> {
  const meta = await readMemberReadingSyncMeta();
  await writeMemberReadingSyncMeta({ ...meta, lastError: error });
}

export type MemberReadingSyncFetchResult = {
  response: MemberReadingSyncResponseV1 | null;
  httpStatus: number | null;
};

type SyncRow = {
  user_id: string;
  schema_version: number;
  revision: string;
  updated_at: string;
  blobs: MemberReadingSyncDocumentV1["blobs"];
};

function emptyOkResponse(): MemberReadingSyncResponseV1 {
  return {
    ok: true,
    schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
    revision: "0",
    updatedAt: new Date(0).toISOString(),
    blobs: {},
  };
}

function fail(
  code: string,
  error: string,
  httpStatus: number | null,
): MemberReadingSyncFetchResult {
  return {
    httpStatus,
    response: {
      ok: false,
      schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
      error,
      code,
    },
  };
}

function isMissingSyncTable(result: MemberReadingSyncFetchResult): boolean {
  const code = result.response?.code ?? "";
  const error = result.response?.error ?? "";
  return (
    code === "PGRST205" ||
    /Could not find the table|schema cache|member_reading_sync_documents/i.test(`${code} ${error}`)
  );
}

/**
 * 生产库尚未建好 member_reading_sync_documents 时，回退到主站账号同步
 *（Render 磁盘上已有历史进度）。表就绪后仍优先走 Supabase。
 */
let preferSiteReadingSync = false;

function syncBaseUrls(primary: string): string[] {
  const normalized = primary.replace(/\/$/, "");
  return /10\.0\.2\.2|localhost|127\.0\.0\.1/.test(normalized)
    ? [normalized, "https://askbible.me"]
    : [normalized];
}

async function memberReadingSyncViaSite(
  sessionToken: string,
  init: RequestInit,
): Promise<MemberReadingSyncFetchResult> {
  const base = getAskBibleBaseUrl();
  for (const requestBase of syncBaseUrls(base)) {
    try {
      const res = await fetchWithTimeout(toAbsoluteUrl(requestBase, "/api/mobile/member/reading-sync"), {
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
        return fail("network", "网络或响应异常", res.status);
      }
      if (!res.ok || !data.ok) return { httpStatus: res.status, response: data };
      return { httpStatus: res.status, response: data };
    } catch (err) {
      if (__DEV__) console.warn("[memberReadingSync] site fetch failed", requestBase, err);
    }
  }
  return fail("network", "network", null);
}

async function withSiteFallback(
  sessionToken: string,
  supabaseCall: () => Promise<MemberReadingSyncFetchResult>,
  siteInit: RequestInit,
): Promise<MemberReadingSyncFetchResult> {
  const supabaseResult = await supabaseCall();
  if (supabaseResult.response?.ok) return supabaseResult;
  if (supabaseResult.response?.code === "unauthorized") return supabaseResult;
  if (
    supabaseResult.response?.code === "supabase_not_configured" ||
    isMissingSyncTable(supabaseResult) ||
    preferSiteReadingSync
  ) {
    if (isMissingSyncTable(supabaseResult)) preferSiteReadingSync = true;
    return memberReadingSyncViaSite(sessionToken, siteInit);
  }
  return supabaseResult;
}

async function resolveAuthedUserId(sessionToken: string): Promise<
  | { ok: true; userId: string; supabase: NonNullable<ReturnType<typeof createAuthedMobileSupabaseClient>> }
  | { ok: false; result: MemberReadingSyncFetchResult }
> {
  if (!isSupabaseAuthConfigured() || !isLikelySupabaseAccessToken(sessionToken)) {
    return { ok: false, result: fail("supabase_not_configured", "Supabase 未配置", 503) };
  }
  const supabase = createAuthedMobileSupabaseClient(sessionToken);
  if (!supabase) {
    return { ok: false, result: fail("supabase_not_configured", "Supabase 未配置", 503) };
  }
  const { data, error } = await supabase.auth.getUser(sessionToken);
  if (error || !data.user?.id) {
    return { ok: false, result: fail("unauthorized", "请先登录。", 401) };
  }
  return { ok: true, userId: data.user.id, supabase };
}

async function readRemoteDocument(
  supabase: NonNullable<ReturnType<typeof createAuthedMobileSupabaseClient>>,
  userId: string,
): Promise<
  | { ok: true; doc: MemberReadingSyncDocumentV1 | null }
  | { ok: false; result: MemberReadingSyncFetchResult }
> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("user_id, schema_version, revision, updated_at, blobs")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (__DEV__) console.warn("[memberReadingSync] select", error.message);
    return { ok: false, result: fail("sync_failed", error.message || "同步失败", 500) };
  }
  if (!data) return { ok: true, doc: null };
  const row = data as SyncRow;
  return {
    ok: true,
    doc: {
      schemaVersion: 1,
      userId: row.user_id,
      revision: row.revision,
      updatedAt: row.updated_at,
      blobs: row.blobs ?? {},
    },
  };
}

async function memberReadingSyncPullSupabase(sessionToken: string): Promise<MemberReadingSyncFetchResult> {
  try {
    const auth = await resolveAuthedUserId(sessionToken);
    if (!auth.ok) return auth.result;
    const remote = await readRemoteDocument(auth.supabase, auth.userId);
    if (!remote.ok) return remote.result;
    if (!remote.doc) return { response: emptyOkResponse(), httpStatus: 200 };
    return {
      httpStatus: 200,
      response: {
        ok: true,
        schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
        revision: remote.doc.revision,
        updatedAt: remote.doc.updatedAt,
        blobs: remote.doc.blobs,
      },
    };
  } catch (err) {
    if (__DEV__) console.warn("[memberReadingSync] pull failed", err);
    return fail("network", "network", null);
  }
}

async function memberReadingSyncPull(sessionToken: string): Promise<MemberReadingSyncFetchResult> {
  return withSiteFallback(sessionToken, () => memberReadingSyncPullSupabase(sessionToken), {
    method: "GET",
  });
}

async function memberReadingSyncPushSupabase(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncFetchResult> {
  try {
    if (push.schemaVersion !== MEMBER_READING_SYNC_SCHEMA_VERSION) {
      return fail("invalid_schema", "invalid schema", 400);
    }
    const auth = await resolveAuthedUserId(sessionToken);
    if (!auth.ok) return auth.result;

    const existing = await readRemoteDocument(auth.supabase, auth.userId);
    if (!existing.ok) return existing.result;
    const merged = mergeMemberReadingSyncDocuments(auth.userId, existing.doc, push);
    const { error } = await auth.supabase.from(TABLE).upsert(
      {
        user_id: merged.userId,
        schema_version: 1,
        revision: merged.revision,
        updated_at: merged.updatedAt,
        blobs: merged.blobs,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      if (__DEV__) console.warn("[memberReadingSync] upsert", error.message);
      return fail("sync_failed", error.message || "同步失败", 500);
    }
    return {
      httpStatus: 200,
      response: {
        ok: true,
        schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
        revision: merged.revision,
        updatedAt: merged.updatedAt,
        blobs: merged.blobs,
      },
    };
  } catch (err) {
    if (__DEV__) console.warn("[memberReadingSync] push failed", err);
    return fail("network", "network", null);
  }
}

async function memberReadingSyncPush(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncFetchResult> {
  return withSiteFallback(
    sessionToken,
    () => memberReadingSyncPushSupabase(sessionToken, push),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(push),
    },
  );
}

function unwrapFetch(result: MemberReadingSyncFetchResult): MemberReadingSyncResponseV1 | null {
  return result.response;
}

export async function pullMemberReadingSync(
  sessionToken: string,
): Promise<MemberReadingSyncResponseV1 | null> {
  return unwrapFetch(await memberReadingSyncPull(sessionToken));
}

export async function pushMemberReadingSync(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncResponseV1 | null> {
  return unwrapFetch(await memberReadingSyncPush(sessionToken, push));
}

export async function pullMemberReadingSyncDetailed(
  sessionToken: string,
): Promise<MemberReadingSyncFetchResult> {
  return memberReadingSyncPull(sessionToken);
}

export async function pushMemberReadingSyncDetailed(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncFetchResult> {
  return memberReadingSyncPush(sessionToken, push);
}

/** 登出校验只用同一份 Supabase 文档，避开主站磁盘/旧合并把计划盖回去。 */
export async function pullMemberReadingSyncFromSupabase(
  sessionToken: string,
): Promise<MemberReadingSyncFetchResult> {
  return memberReadingSyncPullSupabase(sessionToken);
}

export async function pushMemberReadingSyncToSupabase(
  sessionToken: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncFetchResult> {
  return memberReadingSyncPushSupabase(sessionToken, push);
}
