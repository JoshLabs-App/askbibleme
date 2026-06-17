import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import {
  buildReadingPlanChapterQueue,
  indexInReadingPlanQueue,
  type ReadingPlanChapterRef,
} from "@/lib/read/reading-plan-chapter-queue";
import {
  writeReadingPlanAudioSession,
  type ReadingPlanAudioSession,
} from "@/lib/read/reading-plan-audio-session";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";

export type TodayReadingAudioStart = {
  first: ReadingPlanChapterRef;
  session: ReadingPlanAudioSession;
  queue: ReadingPlanChapterRef[];
};

export async function resolveTodayReadingAudioStart(
  prefs: ReadingPlanPrefs = readEffectiveReadingPlanPrefs(),
): Promise<TodayReadingAudioStart | null> {
  const dayCount = prefs.dayCount ?? 365;
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return null;

  const queue = buildReadingPlanChapterQueue(readings);
  const first = queue[0];
  if (!first) return null;

  const dayIndex = isTripleLoopPlanId(prefs.planId) ? 0 : resolveReadingPlanDayIndex(prefs, dayCount);
  const session: ReadingPlanAudioSession = {
    version: 1,
    planId: prefs.planId,
    dayIndex,
    queue,
  };
  return { first, session, queue };
}

/** 写入今日读经音频队列并返回首章（顺序与首页展示一致，如三环：新约 → 智慧 → 旧约）。 */
export async function prepareTodayReadingAudioSessionFromStart(
  prefs: ReadingPlanPrefs = readEffectiveReadingPlanPrefs(),
): Promise<TodayReadingAudioStart | null> {
  const start = await resolveTodayReadingAudioStart(prefs);
  if (!start) return null;
  writeReadingPlanAudioSession(start.session);
  return start;
}

export function nextChapterInTodayReadingQueue(
  queue: readonly ReadingPlanChapterRef[],
  bookId: string,
  chapter: number,
): ReadingPlanChapterRef | null {
  if (queue.length <= 1) return null;
  const idx = indexInReadingPlanQueue(queue, bookId, chapter);
  if (idx < 0) return null;
  return queue[(idx + 1) % queue.length] ?? null;
}
