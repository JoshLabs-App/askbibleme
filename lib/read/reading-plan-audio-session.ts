import type { ReadingPlanChapterRef } from "@/lib/read/reading-plan-chapter-queue";

export const READING_PLAN_AUDIO_SESSION_KEY = "selah-reading-plan-audio-v1";

export type ReadingPlanAudioSession = {
  version: 1;
  planId: string;
  dayIndex: number;
  queue: ReadingPlanChapterRef[];
};

export function readReadingPlanAudioSession(): ReadingPlanAudioSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(READING_PLAN_AUDIO_SESSION_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as ReadingPlanAudioSession;
    if (j?.version !== 1 || typeof j.planId !== "string" || !Array.isArray(j.queue)) return null;
    if (typeof j.dayIndex !== "number" || !Number.isInteger(j.dayIndex) || j.dayIndex < 0) return null;
    const queue = j.queue
      .map((item) => {
        const o = item as ReadingPlanChapterRef;
        if (typeof o?.bookId !== "string" || typeof o?.chapter !== "number") return null;
        return { bookId: o.bookId, chapter: o.chapter };
      })
      .filter((x): x is ReadingPlanChapterRef => x != null);
    if (!queue.length) return null;
    return { version: 1, planId: j.planId, dayIndex: j.dayIndex, queue };
  } catch {
    return null;
  }
}

export function writeReadingPlanAudioSession(session: ReadingPlanAudioSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      sessionStorage.removeItem(READING_PLAN_AUDIO_SESSION_KEY);
    } else {
      sessionStorage.setItem(READING_PLAN_AUDIO_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    /* ignore */
  }
}
