import type { Router } from "expo-router";
import { readEffectiveReadingPlanPrefs } from "./reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { primeTodayReadingPlanPayload } from "./today-reading-plan-payload-prime";
import { armReadPlanFlowAutoplay, armReadPlanFlowTodayLoop } from "./read-plan-flow-autoplay";
import {
  buildPlanChapterQueue,
  pushReadPlanFlowChapter,
  replaceReadPlanFlowChapterAudio,
  type PlanChapterRef,
} from "./read-plan-flow-nav";
import { prefetchTodayReadingPlanQueueAudio } from "./prefetch-plan-flow-chapter-audio";
import { readPlanFlowChapterAudioPrefs } from "./read-plan-flow-audio-prefs";

export type StartTodayPlanFlowOpts = {
  /** 今日章节播完后从头循环，直至用户暂停。默认开启。 */
  loopTodayPlan?: boolean;
  /** 已在章页时用 replace，避免堆栈重复。 */
  replace?: boolean;
};

/** 进入今日 planFlow 指定章：预载计划、arm 自动续章/循环并导航。 */
export async function startTodayPlanFlowScripture(
  router: Pick<Router, "push" | "replace">,
  target: PlanChapterRef,
  opts?: StartTodayPlanFlowOpts,
): Promise<boolean> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return false;
  const queue = buildPlanChapterQueue(readings);
  if (!queue.some((ref) => ref.bookId === target.bookId && ref.chapter === target.chapter)) {
    return false;
  }
  primeTodayReadingPlanPayload(payload);
  const audioPrefs = await readPlanFlowChapterAudioPrefs();
  await prefetchTodayReadingPlanQueueAudio(queue, {
    translationId: audioPrefs.translationId,
    voiceId: audioPrefs.voiceId,
    awaitFirst: true,
  });
  armReadPlanFlowAutoplay();
  if (opts?.loopTodayPlan !== false) {
    armReadPlanFlowTodayLoop();
  }
  if (opts?.replace) {
    replaceReadPlanFlowChapterAudio(router, target);
  } else {
    pushReadPlanFlowChapter(router, target);
  }
  return true;
}

/** 从读经首页或自然首页启动今日朗读：进入首章（planFlow）并标记自动播放。 */
export async function startTodayReadingScriptureFromReadHome(
  router: Pick<Router, "push" | "replace">,
  opts?: StartTodayPlanFlowOpts,
): Promise<boolean> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return false;
  const first = buildPlanChapterQueue(readings)[0];
  if (!first) return false;
  return startTodayPlanFlowScripture(router, first, opts);
}
