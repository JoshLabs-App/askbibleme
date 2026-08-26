import type { MemberReadingSyncBlob, MemberReadingSyncBlobKey } from "@/lib/member-reading-sync/schema";

export type MemberReadingSyncPath =
  | "replace"
  | "pull-only-reinstall"
  | "pull-only-empty"
  | "guest-push"
  | "continue";

export function shouldForcePushMemberReadingSync(reason?: string): boolean {
  return (
    reason === "sign-out" ||
    reason === "manual-debug" ||
    reason === "local-change" ||
    reason === "readingPlanPrefs"
  );
}

export function decideMemberReadingSyncPath(input: {
  boundUserId: string | null;
  requirePullOnly: boolean;
  userId: string;
  remoteHasProgress: boolean;
  localHasProgress: boolean;
  forcePush?: boolean;
}): MemberReadingSyncPath {
  if (input.boundUserId != null && input.boundUserId !== input.userId) return "replace";
  if (input.forcePush && input.localHasProgress) return "continue";
  if (input.requirePullOnly) return "replace";

  if (input.boundUserId == null) {
    if (input.remoteHasProgress) return "pull-only-reinstall";
    if (!input.localHasProgress) return "pull-only-empty";
    return "guest-push";
  }

  if (!input.localHasProgress) return "pull-only-empty";
  return "continue";
}

function blobValue(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
  key: MemberReadingSyncBlobKey,
): unknown {
  return blobs?.[key]?.value;
}

export function blobsHaveMemberReadingProgress(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
): boolean {
  if (!blobs) return false;

  const bookmarks = blobValue(blobs, "bookmarks");
  if (bookmarks && typeof bookmarks === "object" && Object.keys(bookmarks as object).length > 0) {
    return true;
  }

  const highlights = blobValue(blobs, "highlights");
  if (highlights && typeof highlights === "object" && Object.keys(highlights as object).length > 0) {
    return true;
  }

  const lastPosition = blobValue(blobs, "lastPosition");
  if (lastPosition && typeof lastPosition === "object") return true;

  const completed = (blobValue(blobs, "chapterCompletion") as { completed?: unknown } | undefined)?.completed;
  if (Array.isArray(completed) && completed.length > 0) return true;

  const doneKeys = (blobValue(blobs, "todayReadingDone") as { doneKeys?: unknown } | undefined)?.doneKeys;
  if (Array.isArray(doneKeys) && doneKeys.length > 0) return true;

  const fractions = (blobValue(blobs, "todayReadingFraction") as { fractions?: object } | undefined)?.fractions;
  if (fractions && Object.keys(fractions).length > 0) return true;

  const dates = (blobValue(blobs, "habitStats") as { completedDates?: unknown } | undefined)?.completedDates;
  if (Array.isArray(dates) && dates.length > 0) return true;

  const listenSec = (blobValue(blobs, "scriptureListenTotals") as { totalSec?: unknown } | undefined)?.totalSec;
  if (typeof listenSec === "number" && Number.isFinite(listenSec) && listenSec > 0) return true;

  if (blobValue(blobs, "tripleLoopProgress") != null) return true;
  if (blobValue(blobs, "ntDeepRepeatProgress") != null) return true;

  const plan = blobValue(blobs, "readingPlanPrefs") as { chosen?: unknown } | undefined;
  return plan?.chosen === true;
}
