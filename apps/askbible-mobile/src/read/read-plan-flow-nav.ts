import type { Router } from "expo-router";
import { readingIncludesChapter } from "./reading-plan/today-reading-done";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { peekPrimedTodayReadingPlanPayload } from "./today-reading-plan-payload-prime";
import { shouldLoopTodayPlanFlow } from "./read-plan-flow-autoplay";

export type PlanChapterRef = { bookId: string; chapter: number };

const PLAN_CHAPTER_PATH = "/(tabs)/read/[bookId]/[chapter]" as const;

/** 章页 payload 未就绪时回退到 planFlow 启动前 prime 的今日计划。 */
export function resolveEffectiveTodayPlanPayload(
  payload: TodayReadingPlanPayload | null | undefined,
): TodayReadingPlanPayload | null {
  return payload ?? peekPrimedTodayReadingPlanPayload();
}

export function resolvePlanFlowNextTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  const effective = resolveEffectiveTodayPlanPayload(payload);
  if (!effective) return null;
  return resolveTodayPlanLoopNextTarget(effective, currentBookId, currentChapter);
}

export function resolvePlanFlowPrevTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  const effective = resolveEffectiveTodayPlanPayload(payload);
  if (!effective) return null;
  return resolveTodayPlanLoopPrevTarget(effective, currentBookId, currentChapter);
}

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
  allowLoop: boolean,
): PlanChapterRef | null {
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return null;
  if (!readings.some((r) => readingIncludesChapter(r, currentBookId, currentChapter))) return null;
  const queue = buildPlanChapterQueue(readings);
  if (!queue.length) return null;
  const idx = queue.findIndex((ref) => ref.bookId === currentBookId && ref.chapter === currentChapter);
  if (idx < 0) return null;
  if (!allowLoop) {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= queue.length) return null;
    return queue[nextIdx] ?? null;
  }
  const nextIdx = (idx + delta + queue.length) % queue.length;
  return queue[nextIdx] ?? null;
}

export function resolveTodayPlanLoopNextTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  return resolveTodayPlanLoopTarget(
    payload,
    currentBookId,
    currentChapter,
    1,
    shouldLoopTodayPlanFlow(),
  );
}

export function resolveTodayPlanLoopPrevTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  return resolveTodayPlanLoopTarget(
    payload,
    currentBookId,
    currentChapter,
    -1,
    shouldLoopTodayPlanFlow(),
  );
}

/** Non-looping next chapter within today's plan (manual plan flow). */
export function resolveTodayPlanNextTarget(
  payload: TodayReadingPlanPayload | null | undefined,
  currentBookId: string,
  currentChapter: number,
): PlanChapterRef | null {
  return resolveTodayPlanLoopTarget(payload, currentBookId, currentChapter, 1, false);
}

export function pushReadPlanFlowChapter(
  router: Pick<Router, "push">,
  target: PlanChapterRef,
): void {
  router.push({
    pathname: PLAN_CHAPTER_PATH,
    params: {
      bookId: target.bookId,
      chapter: String(target.chapter),
      planFlow: "1",
    },
  });
}

/** 音频自动续章 / 今日读完循环：replace 避免堆栈无限增长；同章重播时传 restartTick。 */
export function replaceReadPlanFlowChapterAudio(
  router: Pick<Router, "replace">,
  target: PlanChapterRef,
  restartTick?: number,
): void {
  router.replace({
    pathname: PLAN_CHAPTER_PATH,
    params: {
      bookId: target.bookId,
      chapter: String(target.chapter),
      planFlow: "1",
      ...(restartTick != null ? { planFlowTick: String(restartTick) } : {}),
    },
  });
}
