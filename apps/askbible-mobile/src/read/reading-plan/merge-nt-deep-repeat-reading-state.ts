import { normalizeNtDeepRepeatChaptersReadKeys } from "./nt-deep-repeat-chapters-read";
import { NT_DEEP_REPEAT_OT_BOOK_IDS } from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import {
  normalizeNtDeepRepeatReadingState,
  type NtDeepRepeatPointer,
  type NtDeepRepeatReadingState,
} from "./nt-deep-repeat-reading";

function pointerProgress(pointer: NtDeepRepeatPointer): number {
  const bookIdx = NT_DEEP_REPEAT_OT_BOOK_IDS.indexOf(pointer.bookId);
  return (bookIdx >= 0 ? bookIdx : 0) * 10_000 + pointer.chapter;
}

function mergePointer(a: NtDeepRepeatPointer, b: NtDeepRepeatPointer): NtDeepRepeatPointer {
  return pointerProgress(a) >= pointerProgress(b) ? a : b;
}

function curriculumProgress(state: NtDeepRepeatReadingState): number {
  return state.curriculumIndex * 1000 + state.dayInSegment;
}

/** 跨设备合并深读进度：取读得最远的一阶/段内天，已读章取并集。 */
export function mergeNtDeepRepeatReadingState(a: unknown, b: unknown): NtDeepRepeatReadingState {
  const left = normalizeNtDeepRepeatReadingState(
    a && typeof a === "object" ? (a as Partial<NtDeepRepeatReadingState>) : null,
  );
  const right = normalizeNtDeepRepeatReadingState(
    b && typeof b === "object" ? (b as Partial<NtDeepRepeatReadingState>) : null,
  );
  const keysLeft = normalizeNtDeepRepeatChaptersReadKeys(left.chaptersReadKeys);
  const keysRight = normalizeNtDeepRepeatChaptersReadKeys(right.chaptersReadKeys);
  const mergedKeys = {
    ot: [...new Set([...keysLeft.ot, ...keysRight.ot])].sort(),
    nt: [...new Set([...keysLeft.nt, ...keysRight.nt])].sort(),
  };
  const lead = curriculumProgress(left) >= curriculumProgress(right) ? left : right;
  const curriculumIndex = lead.curriculumIndex;
  const dayInSegment =
    left.curriculumIndex === right.curriculumIndex
      ? Math.max(left.dayInSegment, right.dayInSegment)
      : lead.dayInSegment;
  const startedAt =
    left.startedAt && right.startedAt
      ? left.startedAt <= right.startedAt
        ? left.startedAt
        : right.startedAt
      : left.startedAt ?? right.startedAt;
  return normalizeNtDeepRepeatReadingState({
    ot: mergePointer(left.ot, right.ot),
    curriculumIndex,
    dayInSegment,
    pace: lead.pace,
    chaptersReadKeys: mergedKeys,
    startedAt,
  });
}
