import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { recordMemberReadingSyncDebug } from "./memberReadingSyncDebug";
import { mergeMemberReadingSyncPush } from "./mergeReadingBlobs";
import {
  pullMemberReadingSyncDetailed,
  pushMemberReadingSync,
  pushMemberReadingSyncDetailed,
  writeMemberReadingSyncMeta,
} from "./memberReadingSyncApi";
import { applyMemberReadingSyncBlobs, exportLocalReadingBlobs } from "./readingSyncLocal";
import type { MemberReadingSyncBlobKey, MemberReadingSyncPushV1, MemberReadingSyncResponseV1 } from "./schema";

export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

function formatSyncApiFailure(
  label: string,
  response: MemberReadingSyncResponseV1 | null,
  httpStatus: number | null,
): string {
  if (response?.error?.trim()) {
    const code = response.code ? `[${response.code}] ` : "";
    return `${label}: ${code}${response.error.trim()}`;
  }
  if (response?.code) return `${label}: [${response.code}]`;
  if (httpStatus != null) return `${label}: HTTP ${httpStatus}`;
  return `${label}: 网络或响应异常`;
}

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

function blobKeys(push: MemberReadingSyncPushV1): MemberReadingSyncBlobKey[] {
  return Object.keys(push.blobs ?? {}) as MemberReadingSyncBlobKey[];
}

export async function runMemberReadingSync(
  sessionToken: string,
  reason?: string,
): Promise<MemberReadingSyncOutcome> {
  const started = Date.now();
  recordMemberReadingSyncDebug({ phase: "start", reason });

  if (!(await isNetworkAvailable())) {
    recordMemberReadingSyncDebug({
      phase: "end",
      reason,
      outcome: "offline",
      durationMs: Date.now() - started,
    });
    return "offline";
  }

  try {
    const localPush = await exportLocalReadingBlobs();
    const localKeys = blobKeys(localPush);
    const pushResult = await pushMemberReadingSyncDetailed(sessionToken, localPush);
    const pushed = pushResult.response;

    if (pushed?.ok && pushed.blobs) {
      await applyMemberReadingSyncBlobs(pushed.blobs);
      await writeMemberReadingSyncMeta({
        revision: pushed.revision ?? null,
        lastSyncedAt: new Date().toISOString(),
      });
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "ok",
        detail: "push+apply",
        blobKeys: localKeys,
        blobCount: localKeys.length,
        durationMs: Date.now() - started,
        errorCount: 0,
      });
      return "ok";
    }

    if (pushed?.code === "unauthorized") {
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "unauthorized",
        durationMs: Date.now() - started,
        errorCount: 1,
      });
      return "unauthorized";
    }

    const pullResult = await pullMemberReadingSyncDetailed(sessionToken);
    const pulled = pullResult.response;
    if (!pulled?.ok) {
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: pulled?.code === "unauthorized" ? "unauthorized" : "skipped",
        detail: formatSyncApiFailure("拉取失败", pulled, pullResult.httpStatus),
        durationMs: Date.now() - started,
        errorCount: 1,
      });
      return pulled?.code === "unauthorized" ? "unauthorized" : "skipped";
    }

    const merged = await mergeAndApply(pulled.blobs, localPush);
    const confirm = await pushMemberReadingSync(sessionToken, { schemaVersion: 1, blobs: merged });
    if (confirm?.ok) {
      await writeMemberReadingSyncMeta({
        revision: confirm.revision ?? pulled.revision ?? null,
        lastSyncedAt: new Date().toISOString(),
      });
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "ok",
        detail: "pull+merge+push",
        blobKeys: Object.keys(merged) as MemberReadingSyncBlobKey[],
        blobCount: Object.keys(merged).length,
        durationMs: Date.now() - started,
        errorCount: 0,
      });
      return "ok";
    }

    await writeMemberReadingSyncMeta({
      revision: pulled.revision ?? null,
      lastSyncedAt: new Date().toISOString(),
    });
    recordMemberReadingSyncDebug({
      phase: "end",
      reason,
      outcome: "ok",
      detail: "pull+merge (confirm push skipped)",
      blobKeys: Object.keys(merged) as MemberReadingSyncBlobKey[],
      blobCount: Object.keys(merged).length,
      durationMs: Date.now() - started,
      errorCount: confirm ? 1 : 0,
    });
    return "ok";
  } catch (err) {
    recordMemberReadingSyncDebug({
      phase: "error",
      reason,
      outcome: "skipped",
      detail: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
      errorCount: 1,
    });
    return "skipped";
  }
}

export function scheduleMemberReadingSync(sessionToken: string, reason = "foreground"): void {
  const now = Date.now();
  if (syncInFlight || now - lastSyncStartedAt < MIN_SYNC_INTERVAL_MS) return;
  lastSyncStartedAt = now;
  recordMemberReadingSyncDebug({ phase: "request", reason });
  syncInFlight = runMemberReadingSync(sessionToken, reason)
    .catch(() => "skipped" as const)
    .finally(() => {
      syncInFlight = null;
    });
}

/** 本地数据变更或手动刷新：跳过 30s 节流，合并并发请求。 */
export async function flushMemberReadingSyncNow(
  sessionToken: string,
  reason = "local-change",
): Promise<MemberReadingSyncOutcome> {
  if (syncInFlight) return syncInFlight;
  lastSyncStartedAt = 0;
  syncInFlight = runMemberReadingSync(sessionToken, reason).finally(() => {
    syncInFlight = null;
    lastSyncStartedAt = Date.now();
  });
  return syncInFlight;
}
