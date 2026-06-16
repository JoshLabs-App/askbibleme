import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { mergeMemberReadingSyncPush } from "./mergeReadingBlobs";
import {
  pullMemberReadingSync,
  pushMemberReadingSync,
  writeMemberReadingSyncMeta,
} from "./memberReadingSyncApi";
import { applyMemberReadingSyncBlobs, exportLocalReadingBlobs } from "./readingSyncLocal";
import type { MemberReadingSyncPushV1 } from "./schema";

export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

let syncInFlight: Promise<MemberReadingSyncOutcome> | null = null;
let lastSyncStartedAt = 0;
const MIN_SYNC_INTERVAL_MS = 30_000;

async function mergeAndApply(
  remoteBlobs: MemberReadingSyncPushV1["blobs"] | undefined,
  localPush: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncPushV1["blobs"]> {
  const merged = mergeMemberReadingSyncPush(remoteBlobs, localPush);
  await applyMemberReadingSyncBlobs(merged);
  return merged;
}

export async function runMemberReadingSync(sessionToken: string): Promise<MemberReadingSyncOutcome> {
  if (!(await isNetworkAvailable())) return "offline";

  const localPush = await exportLocalReadingBlobs();
  const pushed = await pushMemberReadingSync(sessionToken, localPush);

  if (pushed?.ok && pushed.blobs) {
    await applyMemberReadingSyncBlobs(pushed.blobs);
    await writeMemberReadingSyncMeta({
      revision: pushed.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
    });
    return "ok";
  }

  if (pushed?.code === "unauthorized") return "unauthorized";

  const pulled = await pullMemberReadingSync(sessionToken);
  if (!pulled?.ok) return "skipped";

  const merged = await mergeAndApply(pulled.blobs, localPush);
  const confirm = await pushMemberReadingSync(sessionToken, { schemaVersion: 1, blobs: merged });
  if (confirm?.ok) {
    await writeMemberReadingSyncMeta({
      revision: confirm.revision ?? pulled.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
    });
    return "ok";
  }

  await writeMemberReadingSyncMeta({
    revision: pulled.revision ?? null,
    lastSyncedAt: new Date().toISOString(),
  });
  return "ok";
}

export function scheduleMemberReadingSync(sessionToken: string): void {
  const now = Date.now();
  if (syncInFlight || now - lastSyncStartedAt < MIN_SYNC_INTERVAL_MS) return;
  lastSyncStartedAt = now;
  syncInFlight = runMemberReadingSync(sessionToken)
    .catch(() => "skipped" as const)
    .finally(() => {
      syncInFlight = null;
    });
}
