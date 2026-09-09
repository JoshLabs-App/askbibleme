import { getScriptureBookDisplayName } from "../../bible/scripture-book-display-name";
import { t, tFormat } from "../../i18n/site-copy";
import {
  TRIPLE_LOOP_NT_BOOK_IDS,
  TRIPLE_LOOP_OT_BOOK_IDS,
  TRIPLE_LOOP_WISDOM_BOOK_IDS,
  type TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";

/**
 * 三环读经：**状态逻辑全在 `lib/bible/reading-plans/triple-loop-reading.ts`**，
 * 这里只留两个要用手机端 i18n 的显示函数，其余原样转出去。
 *
 * 手机曾有一份逐字重写的拷贝（214 行）。两份同形的实现不会报错，只会各自往前走：
 * 到 2026-09-08 时，「读了几章」这个数字在手机侧是从章名列表算出来的、在网页侧是
 * 单独存的，两者能对不上——而这份状态正是两端互相同步的，同一个账号在两台设备上
 * 会显示不同的进度。lib 那份现在照手机的规则数，两边只剩一个答案。
 */
export {
  TRIPLE_LOOP_NT_BOOK_IDS,
  TRIPLE_LOOP_OT_BOOK_IDS,
  TRIPLE_LOOP_WISDOM_BOOK_IDS,
  advanceTripleLoopOneCalendarDay,
  advanceTripleLoopPointer,
  advanceTripleLoopTrack,
  clipCoordinatedTripleLoopAheadToPlanDay,
  createDefaultTripleLoopReadingState,
  normalizeTripleLoopReadingState,
  pointerMatchesTrack,
  snapTripleLoopStateToPlanDay,
  trackForBookId,
  tripleLoopPointersEqual,
  tripleLoopStateForPlanDay,
} from "@/lib/bible/reading-plans/triple-loop-reading";
export type {
  TripleLoopChaptersRead,
  TripleLoopChaptersReadKeys,
  TripleLoopPointer,
  TripleLoopReadingState,
  TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";

/** 「创世记 第 3 章」这类整句，用 App 的书名与量词。 */
export function formatTripleLoopReadingLineVerbose(bookId: string, chapter: number): string {
  const name = getScriptureBookDisplayName(bookId) || bookId;
  const unit =
    bookId === "PSA" ? t("pages.read.tripleLoopPsalmUnit") : t("pages.read.tripleLoopChapterUnit");
  return tFormat("pages.read.tripleLoopReadingLine", {
    name,
    chapter: String(chapter),
    unit,
  });
}

export function tripleLoopTrackTitle(track: TripleLoopTrack): string {
  if (track === "ot") return t("pages.read.tripleLoopTrackOt");
  if (track === "nt") return t("pages.read.tripleLoopTrackNt");
  return t("pages.read.tripleLoopTrackWisdom");
}
