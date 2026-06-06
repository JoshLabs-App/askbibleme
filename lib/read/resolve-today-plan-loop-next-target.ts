import { readingIncludesChapter } from "@/lib/read/today-reading-done";
import {
  buildReadingPlanChapterQueue,
  indexInReadingPlanQueue,
  type ReadingPlanChapterRef,
} from "@/lib/read/reading-plan-chapter-queue";
import { readEffectiveReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";

/** Next chapter in today's plan queue (wraps); null if not in plan or only one chapter. */
export async function resolveTodayPlanLoopNextTarget(
  bookId: string,
  chapter: number,
): Promise<ReadingPlanChapterRef | null> {
  const prefs = readEffectiveReadingPlanPrefs();
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return null;
  if (!readings.some((r) => readingIncludesChapter(r, bookId, chapter))) return null;
  const queue = buildReadingPlanChapterQueue(readings);
  if (queue.length <= 1) return null;
  const idx = indexInReadingPlanQueue(queue, bookId, chapter);
  if (idx < 0) return null;
  return queue[(idx + 1) % queue.length] ?? null;
}
