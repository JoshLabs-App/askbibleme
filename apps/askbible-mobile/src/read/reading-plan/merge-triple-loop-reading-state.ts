import { normalizeTripleLoopChaptersReadKeys } from "./triple-loop-chapters-read";
import {
  normalizeTripleLoopReadingState,
  TRIPLE_LOOP_NT_BOOK_IDS,
  TRIPLE_LOOP_OT_BOOK_IDS,
  TRIPLE_LOOP_WISDOM_BOOK_IDS,
  type TripleLoopPointer,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "./triple-loop-reading";

function trackOrder(track: TripleLoopTrack): string[] {
  if (track === "ot") return TRIPLE_LOOP_OT_BOOK_IDS;
  if (track === "nt") return TRIPLE_LOOP_NT_BOOK_IDS;
  return TRIPLE_LOOP_WISDOM_BOOK_IDS;
}

function pointerProgress(pointer: TripleLoopPointer, order: string[]): number {
  const bookIdx = order.indexOf(pointer.bookId);
  return (bookIdx >= 0 ? bookIdx : 0) * 10_000 + pointer.chapter;
}

function mergePointer(a: TripleLoopPointer, b: TripleLoopPointer, order: string[]): TripleLoopPointer {
  return pointerProgress(a, order) >= pointerProgress(b, order) ? a : b;
}

/** 跨设备合并三轨进度：各轨取读得最远的位置，已读章取并集。 */
export function mergeTripleLoopReadingState(a: unknown, b: unknown): TripleLoopReadingState {
  const left = normalizeTripleLoopReadingState(
    a && typeof a === "object" ? (a as Partial<TripleLoopReadingState>) : null,
  );
  const right = normalizeTripleLoopReadingState(
    b && typeof b === "object" ? (b as Partial<TripleLoopReadingState>) : null,
  );
  const keysLeft = normalizeTripleLoopChaptersReadKeys(left.chaptersReadKeys);
  const keysRight = normalizeTripleLoopChaptersReadKeys(right.chaptersReadKeys);
  const mergedKeys = {
    ot: [...new Set([...keysLeft.ot, ...keysRight.ot])].sort(),
    nt: [...new Set([...keysLeft.nt, ...keysRight.nt])].sort(),
    wisdom: [...new Set([...keysLeft.wisdom, ...keysRight.wisdom])].sort(),
  };
  const tracks: TripleLoopTrack[] = ["ot", "nt", "wisdom"];
  const mergedPointers = Object.fromEntries(
    tracks.map((track) => [track, mergePointer(left[track], right[track], trackOrder(track))]),
  ) as Pick<TripleLoopReadingState, TripleLoopTrack>;
  const startedAt =
    left.startedAt && right.startedAt
      ? left.startedAt <= right.startedAt
        ? left.startedAt
        : right.startedAt
      : left.startedAt ?? right.startedAt;
  return normalizeTripleLoopReadingState({
    ...mergedPointers,
    chaptersReadKeys: mergedKeys,
    startedAt,
  });
}
