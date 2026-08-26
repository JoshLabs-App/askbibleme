export type PlanChapterRef = { bookId: string; chapter: number };

export function buildPlanChapterQueue(
  readings: Array<{ bookId: string; startChapter: number; endChapter: number }>,
): PlanChapterRef[] {
  const out: PlanChapterRef[] = [];
  for (const r of readings) {
    for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
      out.push({ bookId: r.bookId, chapter: ch });
    }
  }
  return out;
}
