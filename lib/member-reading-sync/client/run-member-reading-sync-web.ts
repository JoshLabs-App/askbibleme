"use client";

import {
  MEMBER_READING_SYNC_META_KEY,
  MEMBER_READING_SYNC_SCHEMA_VERSION,
  type MemberReadingSyncMeta,
  type MemberReadingSyncPushV1,
} from "@/lib/member-reading-sync/schema";
import { mergeMemberReadingSyncPush } from "@/lib/member-reading-sync/merge";
import {
  applyMemberReadingSyncBlobsWeb,
  exportLocalReadingBlobsWeb,
} from "@/lib/member-reading-sync/client/reading-sync-local-web";

export const MEMBER_READING_SYNC_API_PATH = "/api/member/reading-sync";

export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

type MemberReadingSyncResponse = {
  ok: boolean;
  schemaVersion: number;
  revision?: string;
  updatedAt?: string;
  blobs?: MemberReadingSyncPushV1["blobs"];
  code?: string;
};

let syncInFlight: Promise<MemberReadingSyncOutcome> | null = null;
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
    };
  } catch {
    return { revision: null, lastSyncedAt: null };
  }
}

async function writeMemberReadingSyncMetaWeb(meta: MemberReadingSyncMeta): Promise<void> {
  localStorage.setItem(MEMBER_READING_SYNC_META_KEY, JSON.stringify(meta));
}

async function syncFetch(init: RequestInit): Promise<MemberReadingSyncResponse | null> {
  try {
    const res = await fetch(MEMBER_READING_SYNC_API_PATH, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const data = (await res.json().catch(() => null)) as MemberReadingSyncResponse | null;
    if (!data || data.schemaVersion !== MEMBER_READING_SYNC_SCHEMA_VERSION) return null;
    if (!res.ok || !data.ok) return data;
    return data;
  } catch {
    return null;
  }
}

async function mergeAndApplyWeb(
  remoteBlobs: MemberReadingSyncPushV1["blobs"] | undefined,
  localPush: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncPushV1["blobs"]> {
  const merged = mergeMemberReadingSyncPush(remoteBlobs, localPush);
  await applyMemberReadingSyncBlobsWeb(merged);
  return merged;
}

export async function runMemberReadingSyncWeb(): Promise<MemberReadingSyncOutcome> {
  if (typeof window === "undefined" || !navigator.onLine) return "offline";

  const localPush = await exportLocalReadingBlobsWeb();
  const pushed = await syncFetch({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(localPush),
  });

  if (pushed?.ok && pushed.blobs) {
    await applyMemberReadingSyncBlobsWeb(pushed.blobs);
    await writeMemberReadingSyncMetaWeb({
      revision: pushed.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
    });
    return "ok";
  }

  if (pushed?.code === "unauthorized") return "unauthorized";

  const pulled = await syncFetch({ method: "GET" });
  if (!pulled?.ok) return "skipped";

  const merged = await mergeAndApplyWeb(pulled.blobs, localPush);
  const confirm = await syncFetch({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemaVersion: 1, blobs: merged }),
  });

  if (confirm?.ok) {
    await writeMemberReadingSyncMetaWeb({
      revision: confirm.revision ?? pulled.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
    });
    return "ok";
  }

  await writeMemberReadingSyncMetaWeb({
    revision: pulled.revision ?? null,
    lastSyncedAt: new Date().toISOString(),
  });
  return "ok";
}

export function scheduleMemberReadingSyncWeb(): void {
  const now = Date.now();
  if (syncInFlight || now - lastSyncStartedAt < MIN_SYNC_INTERVAL_MS) return;
  lastSyncStartedAt = now;
  syncInFlight = runMemberReadingSyncWeb()
    .catch(() => "skipped" as const)
    .finally(() => {
      syncInFlight = null;
    });
}

export function syncMemberReadingAfterLoginWeb(): void {
  scheduleMemberReadingSyncWeb();
}
