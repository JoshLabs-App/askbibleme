import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { AppLocale } from "@/lib/i18n/config";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";

function chaptersForBookId(bookId: string): number {
  return scriptureBooks.find((b) => b.bookId === bookId)?.chapters ?? 0;
}

/** 导入/构建 bundle 时写入：本次阅读范围章数；单章时写入经卷总章数。 */
export function computeBundledReadingPlanItemChapterTotal(
  reading: Pick<ReadingPlanRange, "bookId" | "startChapter" | "endChapter">,
): number {
  const start = Math.max(1, Math.trunc(reading.startChapter));
  const end = Math.max(start, Math.trunc(reading.endChapter));
  const inRange = end - start + 1;
  if (inRange > 1) return inRange;
  const bookTotal = chaptersForBookId(reading.bookId);
  return bookTotal > 0 ? bookTotal : 1;
}

export function withBundledReadingPlanChapterTotal<T extends Omit<ReadingPlanRange, "planChapterTotal">>(
  reading: T,
): T & { planChapterTotal: number } {
  return {
    ...reading,
    planChapterTotal: computeBundledReadingPlanItemChapterTotal(reading),
  };
}

export function formatReadingPlanChapterTotalLabel(
  planChapterTotal: number,
  bookId: string,
  locale: AppLocale,
): string {
  if (locale === "en") return `${planChapterTotal.toLocaleString()} ch`;
  const unit = bookId === "PSA" ? "篇" : "章";
  return `共${planChapterTotal.toLocaleString()}${unit}`;
}
