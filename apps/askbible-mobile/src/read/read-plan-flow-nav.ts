import type { Router } from "expo-router";
import { readingIncludesChapter } from "./reading-plan/today-reading-done";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";

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

function resolveTodayPlanLoopTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
  delta: 1 | -1,
): PlanChapterRef | null {
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return null;
  if (!readings.some((r) => readingIncludesChapter(r, currentBookId, currentChapter))) return null;
  const queue = buildPlanChapterQueue(readings);
  if (queue.length <= 1) return null;
  const idx = queue.findIndex((ref) => ref.bookId === currentBookId && ref.chapter === currentChapter);
  if (idx < 0) return null;
  const nextIdx = (idx + delta + queue.length) % queue.length;
  return queue[nextIdx] ?? null;
}

export function resolveTodayPlanLoopNextTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  return resolveTodayPlanLoopTarget(payload, currentBookId, currentChapter, 1);
}

export function resolveTodayPlanLoopPrevTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  return resolveTodayPlanLoopTarget(payload, currentBookId, currentChapter, -1);
}

export function pushReadPlanFlowChapter(
  router: Pick<Router, "push">,
  target: PlanChapterRef,
): void {
  router.push({
    pathname: "/read/[bookId]/[chapter]",
    params: {
      bookId: target.bookId,
      chapter: String(target.chapter),
      planFlow: "1",
    },
  });
}
