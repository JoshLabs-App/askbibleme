import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { AppLocale } from "../../i18n/config";
import { getLocale } from "../../i18n/locale-store";
import type { ReadingPlanRange } from "./types";

function chaptersForBookId(bookId: string): number {
  return scriptureBooks.find((b) => b.bookId === bookId)?.chapters ?? 0;
}

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

export function formatReadingPlanChapterTotalLabel(
  planChapterTotal: number,
  bookId: string,
  locale: AppLocale = getLocale(),
): string {
  if (locale === "en") return `${planChapterTotal.toLocaleString()} ch`;
  const unit = bookId === "PSA" ? "篇" : "章";
  return `共${planChapterTotal.toLocaleString()}${unit}`;
}
