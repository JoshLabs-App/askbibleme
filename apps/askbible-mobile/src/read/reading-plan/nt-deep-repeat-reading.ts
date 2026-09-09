import { getScriptureBookDisplayName } from "../../bible/scripture-book-display-name";
import { t, tFormat } from "../../i18n/site-copy";
import type {
  NtDeepRepeatChapterRange,
  NtDeepRepeatSegment,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import type { NtDeepRepeatTrack } from "@/lib/bible/reading-plans/nt-deep-repeat-reading";

/**
 * 新约深读：**状态逻辑全在 `lib/bible/reading-plans/nt-deep-repeat-reading.ts`**，
 * 这里只留要用手机端 i18n 的四个显示函数，其余原样转出去。
 *
 * 与 triple-loop 同样的处理：两份同形实现不会报错，只会各自往前走。
 */
export {
  advanceNtDeepRepeatNtDay,
  advanceNtDeepRepeatOneCalendarDay,
  advanceNtDeepRepeatOtPointer,
  advanceNtDeepRepeatOtTrack,
  createDefaultNtDeepRepeatReadingState,
  currentNtDeepRepeatSegment,
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatStateForPlanDay,
  resolveNtDeepRepeatSegmentDayTarget,
  trackForNtDeepRepeatBookId,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
export type {
  NtDeepRepeatChaptersReadKeys,
  NtDeepRepeatPointer,
  NtDeepRepeatReadingState,
  NtDeepRepeatTrack,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";

/** 「创世记 第 3 章」这类整句，用 App 的书名与量词。 */
export function formatNtDeepRepeatOtLine(bookId: string, chapter: number): string {
  const name = getScriptureBookDisplayName(bookId) || bookId;
  const unit =
    bookId === "PSA" ? t("pages.read.tripleLoopPsalmUnit") : t("pages.read.tripleLoopChapterUnit");
  return tFormat("pages.read.tripleLoopReadingLine", {
    name,
    chapter: String(chapter),
    unit,
  });
}

function formatNtDeepRepeatRangeLine(range: NtDeepRepeatChapterRange): string {
  const name = getScriptureBookDisplayName(range.bookId) || range.bookId;
  if (range.startChapter === range.endChapter) {
    return tFormat("pages.read.ntDeepRepeatStageBookSingle", {
      name,
      chapter: String(range.startChapter),
    });
  }
  return tFormat("pages.read.ntDeepRepeatStageBookRange", {
    name,
    start: String(range.startChapter),
    end: String(range.endChapter),
  });
}

export function formatNtDeepRepeatSegmentLabel(
  segment: NtDeepRepeatSegment,
  dayInSegment: number,
  total: number,
): string {
  const segmentText = segment.ranges
    .map(formatNtDeepRepeatRangeLine)
    .join(t("pages.read.ntDeepRepeatLabelSep"));
  return tFormat("pages.read.ntDeepRepeatSegmentLabel", {
    day: String(dayInSegment),
    total: String(total),
    segment: segmentText,
  });
}

/** 阶梯列表用：书卷 + 章范围（不含第几天） */
export function formatNtDeepRepeatSegmentStageRange(segment: NtDeepRepeatSegment): string {
  return segment.ranges
    .map(formatNtDeepRepeatRangeLine)
    .join(t("pages.read.ntDeepRepeatLabelSep"));
}

export function ntDeepRepeatTrackTitle(track: NtDeepRepeatTrack): string {
  if (track === "ot") return t("pages.read.ntDeepRepeatTrackOt");
  return t("pages.read.ntDeepRepeatTrackNt");
}
