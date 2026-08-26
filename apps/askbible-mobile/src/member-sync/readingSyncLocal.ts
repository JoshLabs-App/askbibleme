export { exportLocalReadingBlobs } from "./readingSyncLocalExport";
export { applyReadingSyncBlob } from "./readingSyncLocalApply";

import { MEMBER_READING_SYNC_BLOB_KEYS, type MemberReadingSyncBlob, type MemberReadingSyncBlobKey } from "./schema";
import { reconcileNtDeepRepeatReadingPlanAfterSync } from "../read/reading-plan/reconcile-nt-deep-repeat-reading-sync";
import { reconcileTripleLoopReadingPlanAfterSync } from "../read/reading-plan/reconcile-triple-loop-reading-sync";
import { clearPrimedTodayReadingPlanPayload } from "../read/today-reading-plan-payload-prime";
import { mergeReadingPlanPrefsValue } from "../read/reading-plan/reading-plan-prefs-merge";
import { readReadingPlanPrefs, writeReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import { isReadingPlanPrefs } from "./readingSyncBlobValidators";
import { applyReadingSyncBlob } from "./readingSyncLocalApply";
import { readingPlanFromAppLocale } from "./readingPlanSyncSidecar";

let applyingRemoteMemberSync = false;
let applyingDepth = 0;

export function isApplyingRemoteMemberSync(): boolean {
  return applyingRemoteMemberSync;
}

export function beginApplyingRemoteMemberSync(): void {
  applyingDepth += 1;
  applyingRemoteMemberSync = true;
}

export function endApplyingRemoteMemberSync(): void {
  applyingDepth = Math.max(0, applyingDepth - 1);
  if (applyingDepth === 0) applyingRemoteMemberSync = false;
}

export async function applyMemberReadingSyncBlobs(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
): Promise<void> {
  if (!blobs) return;
  const planIdBefore = (await readReadingPlanPrefs())?.planId ?? null;
  let recoveredAheadDays = false;
  beginApplyingRemoteMemberSync();
  try {
    for (const key of MEMBER_READING_SYNC_BLOB_KEYS) {
      const blob = blobs[key];
      if (!blob) continue;
      await applyReadingSyncBlob(key, blob.value);
    }
    const sidecarPlan = readingPlanFromAppLocale(blobs.appLocale?.value);
    // 已有正式计划 blob 时不要用侧车：旧 locale 里常是没 aheadDays 的快照。
    if (!blobs.readingPlanPrefs && isReadingPlanPrefs(sidecarPlan)) {
      const current = await readReadingPlanPrefs();
      const merged = current ? mergeReadingPlanPrefsValue(sidecarPlan, current) : sidecarPlan;
      if (isReadingPlanPrefs(merged)) {
        await writeReadingPlanPrefs(merged, { notifySync: false });
      }
    }
    const recoveredAhead =
      (await reconcileTripleLoopReadingPlanAfterSync()) ||
      (await reconcileNtDeepRepeatReadingPlanAfterSync());
    const planIdAfter = (await readReadingPlanPrefs())?.planId ?? null;
    if (planIdBefore !== planIdAfter) {
      clearPrimedTodayReadingPlanPayload();
      const { scriptureChapterPool } = await import("../music/scripture-chapter-pool");
      scriptureChapterPool.stop();
    }
    if (recoveredAhead) recoveredAheadDays = true;
  } finally {
    endApplyingRemoteMemberSync();
  }
  if (recoveredAheadDays) {
    const { notifyMemberReadingLocalChanged } = await import("./requestMemberReadingSync");
    notifyMemberReadingLocalChanged("readingPlanPrefs");
  }
}
