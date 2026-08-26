"use client";

import {
  MEMBER_READING_SYNC_META_KEY,
  MEMBER_READING_SYNC_SCHEMA_VERSION,
  type MemberReadingSyncMeta,
  type MemberReadingSyncPushV1,
} from "@/lib/member-reading-sync/schema";
import {
  mergeMemberReadingSyncDocuments,
  mergeMemberReadingSyncPush,
} from "@/lib/member-reading-sync/merge";
import {
  blobsHaveMemberReadingProgress,
  decideMemberReadingSyncPath,
  shouldForcePushMemberReadingSync,
} from "@/lib/member-reading-sync/member-reading-sync-owner-policy";
import {
  applyMemberReadingSyncBlobsWeb,
  exportLocalReadingBlobsWeb,
  localHasMemberReadingProgressWeb,
} from "@/lib/member-reading-sync/client/reading-sync-local-web";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

const TABLE = "member_reading_sync_documents";

export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

type SyncRow = {
  user_id: string;
  schema_version: number;
  revision: string;
  updated_at: string;
  blobs: MemberReadingSyncPushV1["blobs"];
};

let syncInFlight: Promise<MemberReadingSyncOutcome> | null = null;
let pendingFlushReason: string | undefined;
let lastSyncStartedAt = 0;
const MIN_SYNC_INTERVAL_MS = 30_000;

export async function readMemberReadingSyncMetaWeb(): Promise<MemberReadingSyncMeta> {
  try {
    const raw = localStorage.getItem(MEMBER_READING_SYNC_META_KEY);
    if (!raw) return { revision: null, lastSyncedAt: null };
    const parsed = JSON.parse(raw) as Partial<MemberReadingSyncMeta>;
    return {
      revision: typeof parsed.revision === "string" ? parsed.revision : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      boundUserId: typeof parsed.boundUserId === "string" ? parsed.boundUserId : null,
      requirePullOnly: parsed.requirePullOnly === true,
    };
  } catch {
    return { revision: null, lastSyncedAt: null };
  }
}

export const MEMBER_READING_SYNC_META_UPDATED_EVENT = "askbible:member-reading-sync-meta-updated";

async function writeMemberReadingSyncMetaWeb(meta: MemberReadingSyncMeta): Promise<void> {
  localStorage.setItem(MEMBER_READING_SYNC_META_KEY, JSON.stringify(meta));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMBER_READING_SYNC_META_UPDATED_EVENT));
  }
}

async function resolveAuthed() {
  if (!isSupabaseAuthConfigured()) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return { supabase, userId: data.user.id };
}

async function readRemote(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  userId: string,
): Promise<
  | { ok: true; doc: { schemaVersion: 1; userId: string; revision: string; updatedAt: string; blobs: MemberReadingSyncPushV1["blobs"] } | null }
  | { ok: false }
> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("user_id, schema_version, revision, updated_at, blobs")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false };
  if (!data) return { ok: true, doc: null };
  const row = data as SyncRow;
  return {
    ok: true,
    doc: {
      schemaVersion: 1 as const,
      userId: row.user_id,
      revision: row.revision,
      updatedAt: row.updated_at,
      blobs: row.blobs ?? {},
    },
  };
}

async function upsertRemote(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  doc: ReturnType<typeof mergeMemberReadingSyncDocuments>,
) {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: doc.userId,
      schema_version: MEMBER_READING_SYNC_SCHEMA_VERSION,
      revision: doc.revision,
      updated_at: doc.updatedAt,
      blobs: doc.blobs,
    },
    { onConflict: "user_id" },
  );
  return !error;
}

async function mergeAndApplyWeb(
  remoteBlobs: MemberReadingSyncPushV1["blobs"] | undefined,
  localPush: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncPushV1["blobs"]> {
  const freshLocal = await exportLocalReadingBlobsWeb();
  const merged = mergeMemberReadingSyncPush(
    mergeMemberReadingSyncPush(remoteBlobs, localPush),
    freshLocal,
  );
  await applyMemberReadingSyncBlobsWeb(merged);
  return merged;
}

async function prepareMemberReadingSyncOwnerWeb(userId: string): Promise<"continue" | "replace"> {
  const meta = await readMemberReadingSyncMetaWeb();
  if (meta.boundUserId === userId && !meta.requirePullOnly) return "continue";
  if (meta.boundUserId != null && meta.boundUserId !== userId) {
    await writeMemberReadingSyncMetaWeb({
      revision: null,
      lastSyncedAt: null,
      boundUserId: null,
      requirePullOnly: true,
    });
    return "replace";
  }
  if (meta.requirePullOnly) return "replace";
  return "continue";
}

export async function runMemberReadingSyncWeb(reason?: string): Promise<MemberReadingSyncOutcome> {
  if (typeof window === "undefined" || !navigator.onLine) return "offline";

  const auth = await resolveAuthed();
  if (!auth) return "unauthorized";

  const ownerMode = await prepareMemberReadingSyncOwnerWeb(auth.userId);
  const meta = await readMemberReadingSyncMetaWeb();
  const localPush = await exportLocalReadingBlobsWeb();
  const remote = await readRemote(auth.supabase, auth.userId);
  if (!remote.ok) return "skipped";

  const existing = remote.doc;
  const remoteHasProgress = blobsHaveMemberReadingProgress(existing?.blobs);
  const localHasProgress = localHasMemberReadingProgressWeb();
  const forcePush = shouldForcePushMemberReadingSync(reason);
  const path = decideMemberReadingSyncPath({
    boundUserId: meta.boundUserId ?? null,
    requirePullOnly: meta.requirePullOnly === true || ownerMode === "replace",
    userId: auth.userId,
    remoteHasProgress,
    localHasProgress,
    forcePush,
  });

  if (path === "pull-only-reinstall" || path === "pull-only-empty" || path === "replace") {
    if (existing?.blobs) {
      await applyMemberReadingSyncBlobsWeb(existing.blobs);
    }
    await writeMemberReadingSyncMetaWeb({
      revision: existing?.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
      boundUserId: auth.userId,
      requirePullOnly: false,
    });
    if (path !== "replace" || !localHasProgress || forcePush) {
      return "ok";
    }
  }

  const pushedDoc = mergeMemberReadingSyncDocuments(auth.userId, existing, localPush);
  const pushedOk = await upsertRemote(auth.supabase, pushedDoc);
  if (pushedOk) {
    const needsReconcile = await applyMemberReadingSyncBlobsWeb(pushedDoc.blobs);
    await writeMemberReadingSyncMetaWeb({
      revision: pushedDoc.revision,
      lastSyncedAt: new Date().toISOString(),
      boundUserId: auth.userId,
      requirePullOnly: false,
    });
    if (needsReconcile) {
      const retryLocal = await exportLocalReadingBlobsWeb();
      const confirmDoc = mergeMemberReadingSyncDocuments(auth.userId, pushedDoc, retryLocal);
      await upsertRemote(auth.supabase, confirmDoc);
      await writeMemberReadingSyncMetaWeb({
        revision: confirmDoc.revision,
        lastSyncedAt: new Date().toISOString(),
        boundUserId: auth.userId,
        requirePullOnly: false,
      });
    }
    return "ok";
  }

  const pulledRemote = existing ? { ok: true as const, doc: existing } : await readRemote(auth.supabase, auth.userId);
  if (!pulledRemote.ok || !pulledRemote.doc) return "skipped";
  const pulled = pulledRemote.doc;
  const merged = await mergeAndApplyWeb(pulled.blobs, localPush);
  const confirmDoc = mergeMemberReadingSyncDocuments(auth.userId, pulled, {
    schemaVersion: 1,
    blobs: merged,
  });
  const confirmed = await upsertRemote(auth.supabase, confirmDoc);
  await writeMemberReadingSyncMetaWeb({
    revision: confirmed ? confirmDoc.revision : pulled.revision,
    lastSyncedAt: new Date().toISOString(),
    boundUserId: auth.userId,
    requirePullOnly: false,
  });
  return "ok";
}

export function scheduleMemberReadingSyncWeb(reason?: string): void {
  const now = Date.now();
  const bypassThrottle = shouldForcePushMemberReadingSync(reason);
  if (syncInFlight) {
    if (bypassThrottle) pendingFlushReason = reason;
    return;
  }
  if (!bypassThrottle && now - lastSyncStartedAt < MIN_SYNC_INTERVAL_MS) return;
  lastSyncStartedAt = now;
  syncInFlight = runMemberReadingSyncWeb(reason)
    .catch(() => "skipped" as const)
    .finally(() => {
      syncInFlight = null;
      if (pendingFlushReason) {
        const next = pendingFlushReason;
        pendingFlushReason = undefined;
        scheduleMemberReadingSyncWeb(next);
      }
    });
}

export function flushMemberReadingSyncWebNow(reason?: string): void {
  pendingFlushReason = reason;
  lastSyncStartedAt = 0;
  scheduleMemberReadingSyncWeb(reason);
}

export function syncMemberReadingAfterLoginWeb(): void {
  scheduleMemberReadingSyncWeb();
}

export async function markMemberReadingSyncPullOnlyWeb(): Promise<void> {
  const meta = await readMemberReadingSyncMetaWeb();
  await writeMemberReadingSyncMetaWeb({
    ...meta,
    boundUserId: null,
    requirePullOnly: true,
    revision: null,
    lastSyncedAt: null,
  });
}
