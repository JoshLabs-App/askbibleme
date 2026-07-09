import type { ReadingPlanRange } from "./reading-plan/types";

export type ChapterRef = {
  bookId: string;
  chapter: number;
};

export function buildChapterQueue(readings: ReadingPlanRange[]): ChapterRef[] {
  const out: ChapterRef[] = [];
  for (const r of readings) {
    for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
      out.push({ bookId: r.bookId, chapter: ch });
    }
  }
  return out;
}

export function sameChapter(a: ChapterRef, b: ChapterRef): boolean {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

export function formatDisplayNickname(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
