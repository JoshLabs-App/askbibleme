"use client";

import type { AuthChangeEvent } from "@supabase/supabase-js";

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
  clearMemberReadingLocalDataWeb,
  exportLocalReadingBlobsWeb,
  exportLocalReadingBlobsWebSnapshot,
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
let accountGeneration = 0;
const MIN_SYNC_INTERVAL_MS = 30_000;
const ARCHIVE_PREFIX = "askbible.member-reading-sync-owner-archive.v1:";
let ownerPreparation: Promise<void> = Promise.resolve();
let activeAuthOwner: string | null = null;
// Storage failure must never interrupt account isolation. Retry archives after personal data frees space.
const pendingArchives = new Map<string, string>();
let pendingMeta: MemberReadingSyncMeta | null = null;

export async function readMemberReadingSyncMetaWeb(): Promise<MemberReadingSyncMeta> {
  try {
    const parsed = readMetaNow();
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

function writeMemberReadingSyncMetaWeb(meta: MemberReadingSyncMeta): void {
  pendingMeta = meta;
  try {
    localStorage.setItem(MEMBER_READING_SYNC_META_KEY, JSON.stringify(meta));
    pendingMeta = null;
  } catch { /* Keep the current owner in memory when browser storage is unavailable. */ }
  for (const [owner, archive] of pendingArchives) {
    try {
      localStorage.setItem(ARCHIVE_PREFIX + owner, archive);
      pendingArchives.delete(owner);
    } catch { /* Retain it for this tab and retry at the next metadata write. */ }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMBER_READING_SYNC_META_UPDATED_EVENT));
  }
}

function readMetaNow(): MemberReadingSyncMeta {
  if (pendingMeta) return pendingMeta;
  try { return JSON.parse(localStorage.getItem(MEMBER_READING_SYNC_META_KEY) ?? "null") ?? {}; }
  catch { return { revision: null, lastSyncedAt: null }; }
}

function archiveOwner(userId: string): void {
  const archive = JSON.stringify(exportLocalReadingBlobsWebSnapshot());
  pendingArchives.set(userId, archive);
  try {
    localStorage.setItem(ARCHIVE_PREFIX + userId, archive);
    pendingArchives.delete(userId);
  } catch { /* Isolation continues; the archive remains available to its owner in this tab. */ }
}

function readOwnerArchive(userId: string): string | null {
  const pending = pendingArchives.get(userId);
  if (pending) return pending;
  try { return localStorage.getItem(ARCHIVE_PREFIX + userId); }
  catch { return null; }
}

async function prepareOwner(userId: string, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) return;
  activeAuthOwner = userId;
  const meta = readMetaNow();
  if (meta.boundUserId === userId) return;
  const rawArchive = readOwnerArchive(userId);
  // Do this before any catalog/network await: B must never display A's progress when offline.
  if (meta.boundUserId || meta.requirePullOnly || rawArchive) {
    if (meta.boundUserId) archiveOwner(meta.boundUserId);
    clearMemberReadingLocalDataWeb();
    writeMemberReadingSyncMetaWeb({ revision: null, lastSyncedAt: null, boundUserId: userId, requirePullOnly: false });
    if (rawArchive) {
      let archived: MemberReadingSyncPushV1 | null = null;
      try { archived = JSON.parse(rawArchive) as MemberReadingSyncPushV1; } catch { /* Keep corrupt archives for recovery. */ }
      if (archived?.schemaVersion === 1 && archived.blobs) {
        await applyMemberReadingSyncBlobsWeb(archived.blobs, isCurrent);
      }
    }
  }
}

/** Called synchronously by the auth listener; never calls Supabase under its auth lock. */
export function handleMemberReadingAuthChangeWeb(userId: string | null, initial = false): void {
  // A first anonymous visit owns its guest progress; an expired member session does not.
  if (initial && userId == null && !readMetaNow().boundUserId) return;
  accountGeneration += 1;
  pendingFlushReason = undefined;
  const generation = accountGeneration;
  if (userId == null) {
    clearMemberReadingAfterSignOutWeb();
    ownerPreparation = Promise.resolve();
  } else {
    ownerPreparation = prepareOwner(userId, () => generation === accountGeneration);
    // The sync runner also awaits this promise and reports a skipped sync on storage failure.
    void ownerPreparation.catch(() => undefined);
  }
}

export function discardMemberReadingOwnerArchiveWeb(userId: string): void {
  pendingArchives.delete(userId);
  localStorage.removeItem(ARCHIVE_PREFIX + userId);
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
  isCurrent: () => boolean,
): Promise<MemberReadingSyncPushV1["blobs"]> {
  const freshLocal = await exportLocalReadingBlobsWeb();
  const merged = mergeMemberReadingSyncPush(
    mergeMemberReadingSyncPush(remoteBlobs, localPush),
    freshLocal,
  );
  await applyMemberReadingSyncBlobsWeb(merged, isCurrent);
  return merged;
}

export async function runMemberReadingSyncWeb(reason?: string): Promise<MemberReadingSyncOutcome> {
  if (typeof window === "undefined" || !navigator.onLine) return "offline";
  if (!isSupabaseAuthConfigured()) return "unauthorized";
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return "unauthorized";
  const generation = accountGeneration;
  let accountChanged = false;
  // Subscribe before the first network call: a delayed getUser must not resurrect a signed-out owner.
  const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN") accountChanged = true;
  });
  const isCurrent = () => !accountChanged && generation === accountGeneration;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!isCurrent() || error || !data.user?.id) return "unauthorized";
    return await runForOwner({ supabase, userId: data.user.id }, reason, isCurrent);
  } finally {
    listener.subscription.unsubscribe();
  }
}

async function runForOwner(
  auth: { supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>; userId: string },
  reason: string | undefined,
  isCurrent: () => boolean,
): Promise<MemberReadingSyncOutcome> {
  await ownerPreparation;
  if (!isCurrent()) return "unauthorized";
  await prepareOwner(auth.userId, isCurrent);
  if (!isCurrent()) return "unauthorized";
  const meta = await readMemberReadingSyncMetaWeb();
  const localPush = await exportLocalReadingBlobsWeb();
  if (!isCurrent()) return "unauthorized";
  const remote = await readRemote(auth.supabase, auth.userId);
  if (!isCurrent()) return "unauthorized";
  if (!remote.ok) return "skipped";

  const existing = remote.doc;
  const remoteHasProgress = blobsHaveMemberReadingProgress(existing?.blobs);
  const localHasProgress = localHasMemberReadingProgressWeb();
  const forcePush = shouldForcePushMemberReadingSync(reason);
  const path = decideMemberReadingSyncPath({
    boundUserId: meta.boundUserId ?? null,
    requirePullOnly: meta.requirePullOnly === true,
    userId: auth.userId,
    remoteHasProgress,
    localHasProgress,
    forcePush,
  });

  if (path === "pull-only-reinstall" || path === "pull-only-empty" || path === "replace") {
    if (path === "replace" || path === "pull-only-reinstall") clearMemberReadingLocalDataWeb();
    if (existing?.blobs) {
      await applyMemberReadingSyncBlobsWeb(existing.blobs, isCurrent);
    }
    if (!isCurrent()) return "unauthorized";
    await writeMemberReadingSyncMetaWeb({
      revision: existing?.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
      boundUserId: auth.userId,
      requirePullOnly: false,
    });
    // Replacement never falls through to upload the snapshot captured under the previous owner.
    return "ok";
  }

  const pushedDoc = mergeMemberReadingSyncDocuments(auth.userId, existing, localPush);
  const pushedOk = await upsertRemote(auth.supabase, pushedDoc);
  if (!isCurrent()) return "unauthorized";
  if (pushedOk) {
    // Preserve reading activity made while the upload was in flight.
    const freshLocal = await exportLocalReadingBlobsWeb();
    if (!isCurrent()) return "unauthorized";
    const merged = mergeMemberReadingSyncPush(pushedDoc.blobs, freshLocal);
    const localChanged = Object.entries(merged).some(([key, blob]) =>
      JSON.stringify(blob?.value) !== JSON.stringify(pushedDoc.blobs[key as keyof typeof pushedDoc.blobs]?.value),
    );
    const needsReconcile = await applyMemberReadingSyncBlobsWeb(merged, isCurrent);
    if (!isCurrent()) return "unauthorized";
    await writeMemberReadingSyncMetaWeb({
      revision: pushedDoc.revision,
      lastSyncedAt: new Date().toISOString(),
      boundUserId: auth.userId,
      requirePullOnly: false,
    });
    if (needsReconcile || localChanged) {
      const retryLocal = await exportLocalReadingBlobsWeb();
      if (!isCurrent()) return "unauthorized";
      const confirmDoc = mergeMemberReadingSyncDocuments(auth.userId, pushedDoc, retryLocal);
      const confirmed = await upsertRemote(auth.supabase, confirmDoc);
      if (!isCurrent()) return "unauthorized";
      if (!confirmed) return "skipped";
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
  if (!isCurrent()) return "unauthorized";
  if (!pulledRemote.ok || !pulledRemote.doc) return "skipped";
  const pulled = pulledRemote.doc;
  const merged = await mergeAndApplyWeb(pulled.blobs, localPush, isCurrent);
  if (!isCurrent()) return "unauthorized";
  const confirmDoc = mergeMemberReadingSyncDocuments(auth.userId, pulled, {
    schemaVersion: 1,
    blobs: merged,
  });
  const confirmed = await upsertRemote(auth.supabase, confirmDoc);
  if (!isCurrent()) return "unauthorized";
  await writeMemberReadingSyncMetaWeb({
    revision: confirmed ? confirmDoc.revision : pulled.revision,
    lastSyncedAt: new Date().toISOString(),
    boundUserId: auth.userId,
    requirePullOnly: false,
  });
  return "ok";
}

export function scheduleMemberReadingSyncWeb(reason?: string): Promise<MemberReadingSyncOutcome> {
  const now = Date.now();
  const bypassThrottle = reason === "auth-change" || shouldForcePushMemberReadingSync(reason);
  if (syncInFlight) {
    if (bypassThrottle) pendingFlushReason = reason;
    return syncInFlight;
  }
  if (!bypassThrottle && now - lastSyncStartedAt < MIN_SYNC_INTERVAL_MS) {
    return Promise.resolve("skipped");
  }
  lastSyncStartedAt = now;
  syncInFlight = (async () => {
    let nextReason = reason;
    let outcome: MemberReadingSyncOutcome;
    do {
      pendingFlushReason = undefined;
      outcome = await runMemberReadingSyncWeb(nextReason).catch(() => "skipped" as const);
      nextReason = pendingFlushReason;
    } while (nextReason !== undefined);
    return outcome;
  })().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

/**
 * Like scheduleMemberReadingSyncWeb, but returns a promise that resolves once
 * the flush actually completes — callers that need to guarantee the push
 * finished before doing something irreversible (e.g. signing out) must await
 * this instead of the fire-and-forget schedule call.
 */
export function flushMemberReadingSyncWebNow(reason?: string): Promise<MemberReadingSyncOutcome> {
  lastSyncStartedAt = 0;
  return scheduleMemberReadingSyncWeb(reason ?? "local-change");
}

export function syncMemberReadingAfterLoginWeb(): void {
  scheduleMemberReadingSyncWeb();
}

export function markMemberReadingSyncPullOnlyWeb(): void {
  accountGeneration += 1;
  pendingFlushReason = undefined;
  const meta = readMetaNow();
  writeMemberReadingSyncMetaWeb({
    ...meta,
    boundUserId: null,
    requirePullOnly: true,
    revision: null,
    lastSyncedAt: null,
  });
}

/** Called only after a successful sign-out or account deletion. */
export function clearMemberReadingAfterSignOutWeb(): void {
  const meta = readMetaNow();
  const owner = meta.boundUserId ?? activeAuthOwner;
  if (owner) archiveOwner(owner);
  clearMemberReadingLocalDataWeb();
  markMemberReadingSyncPullOnlyWeb();
  activeAuthOwner = null;
}
