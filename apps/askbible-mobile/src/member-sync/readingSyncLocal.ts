export { exportLocalReadingBlobs } from "./readingSyncLocalExport";
export { applyReadingSyncBlob } from "./readingSyncLocalApply";

import { MEMBER_READING_SYNC_BLOB_KEYS, type MemberReadingSyncBlob, type MemberReadingSyncBlobKey } from "./schema";
import { reconcileNtDeepRepeatReadingPlanAfterSync } from "../read/reading-plan/reconcile-nt-deep-repeat-reading-sync";
import { reconcileTripleLoopReadingPlanAfterSync } from "../read/reading-plan/reconcile-triple-loop-reading-sync";
import { applyReadingSyncBlob } from "./readingSyncLocalApply";

let applyingRemoteMemberSync = false;

export function isApplyingRemoteMemberSync(): boolean {
  return applyingRemoteMemberSync;
}

export async function applyMemberReadingSyncBlobs(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
): Promise<void> {
  if (!blobs) return;
  applyingRemoteMemberSync = true;
  try {
    for (const key of MEMBER_READING_SYNC_BLOB_KEYS) {
      const blob = blobs[key];
      if (!blob) continue;
      await applyReadingSyncBlob(key, blob.value);
    }
    await reconcileTripleLoopReadingPlanAfterSync();
    await reconcileNtDeepRepeatReadingPlanAfterSync();
  } finally {
    applyingRemoteMemberSync = false;
  }
}
