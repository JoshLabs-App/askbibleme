import { buildReadingPlanChapterQueue, indexInReadingPlanQueue } from "@/lib/read/reading-plan-chapter-queue";
import {
  writeReadingPlanAudioSession,
  type ReadingPlanAudioSession,
} from "@/lib/read/reading-plan-audio-session";
import { fetchReadingPlanDayClient } from "@/lib/read/fetch-reading-plan-day-client";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";

/**
 * If an active plan exists and `bookId/chapter` is in today's queue, refresh the audio session.
 * Returns the session when the current chapter is part of today's plan.
 */
export async function prepareReadingPlanAudioSessionForChapter(
  bookId: string,
  chapter: number,
  prefs: ReadingPlanPrefs = readEffectiveReadingPlanPrefs(),
): Promise<ReadingPlanAudioSession | null> {

  const dayCount = prefs.dayCount ?? 365;
  const dayIndex = resolveReadingPlanDayIndex(prefs, dayCount);
  const payload = await fetchReadingPlanDayClient(prefs.planId, dayIndex);
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) {
    writeReadingPlanAudioSession(null);
    return null;
  }

  const queue = buildReadingPlanChapterQueue(readings);
  const idx = indexInReadingPlanQueue(queue, bookId, chapter);
  if (idx < 0) {
    writeReadingPlanAudioSession(null);
    return null;
  }

  const session: ReadingPlanAudioSession = {
    version: 1,
    planId: prefs.planId,
    dayIndex,
    queue,
  };
  writeReadingPlanAudioSession(session);
  return session;
}
