"use client";

import {
  readStoredAskbibleWebSession,
  subscribeAskbibleWebAuth,
} from "@/lib/askbible-web-auth-client";
import { endpointBase } from "@/lib/endpoints";
import {
  MEMBER_READING_SYNC_META_KEY,
  type MemberReadingSyncDocumentV1,
  type MemberReadingSyncMeta,
  type MemberReadingSyncPushV1,
} from "@/lib/member-reading-sync/schema";
import { mergeMemberReadingSyncPush } from "@/lib/member-reading-sync/merge";
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

export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

let syncInFlight: Promise<MemberReadingSyncOutcome> | null = null;
let pendingFlushReason: string | undefined;
let lastSyncStartedAt = 0;
let accountGeneration = 0;
const MIN_SYNC_INTERVAL_MS = 30_000;
const ARCHIVE_PREFIX = "askbible.member-reading-sync-owner-archive.v1:";
let ownerPreparation: Promise<void> = Promise.resolve();
let activeAuthOwner: string | null = null;
const pendingArchives = new Map<string, string>();
let pendingMeta: MemberReadingSyncMeta | null = null;

function syncApiBase(): string {
  return endpointBase("api").replace(/\/+$/, "");
}

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
  } catch {
    /* Keep the current owner in memory when browser storage is unavailable. */
  }
  for (const [owner, archive] of pendingArchives) {
    try {
      localStorage.setItem(ARCHIVE_PREFIX + owner, archive);
      pendingArchives.delete(owner);
    } catch {
      /* Retain it for this tab and retry at the next metadata write. */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMBER_READING_SYNC_META_UPDATED_EVENT));
  }
}

function readMetaNow(): MemberReadingSyncMeta {
  if (pendingMeta) return pendingMeta;
  try {
    return JSON.parse(localStorage.getItem(MEMBER_READING_SYNC_META_KEY) ?? "null") ?? {};
  } catch {
    return { revision: null, lastSyncedAt: null };
  }
}

function archiveOwner(userId: string): void {
  const archive = JSON.stringify(exportLocalReadingBlobsWebSnapshot());
  pendingArchives.set(userId, archive);
  try {
    localStorage.setItem(ARCHIVE_PREFIX + userId, archive);
    pendingArchives.delete(userId);
  } catch {
    /* Isolation continues; the archive remains available to its owner in this tab. */
  }
}

function readOwnerArchive(userId: string): string | null {
  const pending = pendingArchives.get(userId);
  if (pending) return pending;
  try {
    return localStorage.getItem(ARCHIVE_PREFIX + userId);
  } catch {
    return null;
  }
}

async function prepareOwner(userId: string, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) return;
  activeAuthOwner = userId;
  const meta = readMetaNow();
  if (meta.boundUserId === userId) return;
  const rawArchive = readOwnerArchive(userId);
  if (meta.boundUserId || meta.requirePullOnly || rawArchive) {
    if (meta.boundUserId) archiveOwner(meta.boundUserId);
    clearMemberReadingLocalDataWeb();
    writeMemberReadingSyncMetaWeb({
      revision: null,
      lastSyncedAt: null,
      boundUserId: userId,
      requirePullOnly: false,
    });
    if (rawArchive) {
      let archived: MemberReadingSyncPushV1 | null = null;
      try {
        archived = JSON.parse(rawArchive) as MemberReadingSyncPushV1;
      } catch {
        /* Keep corrupt archives for recovery. */
      }
      if (archived?.schemaVersion === 1 && archived.blobs) {
        await applyMemberReadingSyncBlobsWeb(archived.blobs, isCurrent);
      }
    }
  }
}

export function handleMemberReadingAuthChangeWeb(userId: string | null, initial = false): void {
  if (initial && userId == null && !readMetaNow().boundUserId) return;
  accountGeneration += 1;
  pendingFlushReason = undefined;
  const generation = accountGeneration;
  if (userId == null) {
    clearMemberReadingAfterSignOutWeb();
    ownerPreparation = Promise.resolve();
  } else {
    ownerPreparation = prepareOwner(userId, () => generation === accountGeneration);
    void ownerPreparation.catch(() => undefined);
  }
}

export function discardMemberReadingOwnerArchiveWeb(userId: string): void {
  pendingArchives.delete(userId);
  try {
    localStorage.removeItem(ARCHIVE_PREFIX + userId);
  } catch {
    /* Ignore storage errors */
  }
}

async function readRemote(
  token: string,
): Promise<{ ok: true; doc: MemberReadingSyncDocumentV1 | null } | { ok: false; unauthorized?: boolean }> {
  try {
    const res = await fetch(`${syncApiBase()}/v1/sync/reading`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { ok: false, unauthorized: true };
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; doc?: MemberReadingSyncDocumentV1 | null };
    if (!data?.ok) return { ok: false };
    return { ok: true, doc: data.doc ?? null };
  } catch {
    return { ok: false };
  }
}

async function pushRemoteMerged(
  token: string,
  blobs: MemberReadingSyncPushV1["blobs"],
): Promise<{ ok: true; doc: MemberReadingSyncDocumentV1 } | { ok: false; unauthorized?: boolean }> {
  try {
    const res = await fetch(`${syncApiBase()}/v1/sync/reading`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ blobs }),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, unauthorized: true };
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; doc?: MemberReadingSyncDocumentV1 };
    if (!data?.ok || !data.doc) return { ok: false };
    return { ok: true, doc: data.doc };
  } catch {
    return { ok: false };
  }
}

export async function runMemberReadingSyncWeb(reason?: string): Promise<MemberReadingSyncOutcome> {
  if (typeof window === "undefined" || !navigator.onLine) return "offline";
  const session = readStoredAskbibleWebSession();
  if (!session?.sessionToken || !session.user?.id) return "unauthorized";

  const generation = accountGeneration;
  let accountChanged = false;
  const unsubscribe = subscribeAskbibleWebAuth(() => {
    accountChanged = true;
  });
  const isCurrent = () =>
    !accountChanged &&
    generation === accountGeneration &&
    readStoredAskbibleWebSession()?.user.id === session.user.id;

  try {
    return await runForOwner({ token: session.sessionToken, userId: session.user.id }, reason, isCurrent);
  } finally {
    unsubscribe();
  }
}

async function runForOwner(
  auth: { token: string; userId: string },
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

  const remote = await readRemote(auth.token);
  if (!isCurrent()) return "unauthorized";
  if (!remote.ok) return remote.unauthorized ? "unauthorized" : "skipped";

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
    writeMemberReadingSyncMetaWeb({
      revision: existing?.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
      boundUserId: auth.userId,
      requirePullOnly: false,
    });
    return "ok";
  }

  // Server (`askbible-sync`) merges authoritatively in one round-trip!
  const pushed = await pushRemoteMerged(auth.token, localPush.blobs);
  if (!isCurrent()) return "unauthorized";
  if (!pushed.ok) return pushed.unauthorized ? "unauthorized" : "skipped";

  const freshLocal = await exportLocalReadingBlobsWeb();
  if (!isCurrent()) return "unauthorized";
  const merged = mergeMemberReadingSyncPush(pushed.doc.blobs, freshLocal);
  const localChanged = Object.entries(merged).some(
    ([key, blob]) =>
      JSON.stringify(blob?.value) !==
      JSON.stringify(pushed.doc.blobs[key as keyof typeof pushed.doc.blobs]?.value),
  );
  const needsReconcile = await applyMemberReadingSyncBlobsWeb(merged, isCurrent);
  if (!isCurrent()) return "unauthorized";
  writeMemberReadingSyncMetaWeb({
    revision: pushed.doc.revision,
    lastSyncedAt: new Date().toISOString(),
    boundUserId: auth.userId,
    requirePullOnly: false,
  });

  if (needsReconcile || localChanged) {
    const retryLocal = await exportLocalReadingBlobsWeb();
    if (!isCurrent()) return "unauthorized";
    const confirmed = await pushRemoteMerged(auth.token, retryLocal.blobs);
    if (!isCurrent()) return "unauthorized";
    if (!confirmed.ok) return confirmed.unauthorized ? "unauthorized" : "skipped";
    writeMemberReadingSyncMetaWeb({
      revision: confirmed.doc.revision,
      lastSyncedAt: new Date().toISOString(),
      boundUserId: auth.userId,
      requirePullOnly: false,
    });
  }

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
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export function flushMemberReadingSyncWebNow(reason?: string): Promise<MemberReadingSyncOutcome> {
  lastSyncStartedAt = 0;
  return scheduleMemberReadingSyncWeb(reason ?? "local-change");
}

export function syncMemberReadingAfterLoginWeb(): void {
  void scheduleMemberReadingSyncWeb();
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

export function clearMemberReadingAfterSignOutWeb(): void {
  const meta = readMetaNow();
  const owner = meta.boundUserId ?? activeAuthOwner;
  if (owner) archiveOwner(owner);
  clearMemberReadingLocalDataWeb();
  markMemberReadingSyncPullOnlyWeb();
  activeAuthOwner = null;
}
