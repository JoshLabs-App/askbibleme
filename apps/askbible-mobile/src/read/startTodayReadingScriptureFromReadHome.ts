import type { Router } from "expo-router";
import { InteractionManager } from "react-native";
import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import { buildScriptureChapterPool } from "./build-scripture-chapter-pool";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { prefetchTodayReadingPlanQueueAudio } from "./prefetch-plan-flow-chapter-audio";
import { readPlanFlowChapterAudioPrefs } from "./read-plan-flow-audio-prefs";
import { runPlanFlowEntryCallback } from "./read-plan-flow-autoplay";
import { readEffectiveReadingPlanPrefs } from "./reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { primeTodayReadingPlanPayload } from "./today-reading-plan-payload-prime";
import {
  buildPlanChapterQueue,
  pushReadPlanFlowChapter,
  replaceReadPlanFlowChapterAudio,
  type PlanChapterRef,
} from "./read-plan-flow-nav";
import { resolveTodayPlanScriptureStartTarget } from "./today-plan-scripture-resume";

export type StartTodayPlanFlowOpts = {
  loopTodayPlan?: boolean;
  replace?: boolean;
  startAtSec?: number;
};

/** 进入今日 planFlow：预载队列 → 建播放池 → 导航 → playAt（音乐列表同款）。 */
export async function startTodayPlanFlowScripture(
  router: Pick<Router, "push" | "replace">,
  target: PlanChapterRef,
  opts?: StartTodayPlanFlowOpts,
): Promise<boolean> {
  try {
    runPlanFlowEntryCallback();
    await configureScriptureShellAudioMode();

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

    const tracks = await buildScriptureChapterPool(
      queue,
      audioPrefs.translationId,
      audioPrefs.voiceId,
    );
    if (!tracks.length) return false;

    const loopTodayPlan = opts?.loopTodayPlan !== false;
    scriptureChapterPool.load(tracks, { loop: loopTodayPlan });

    const startIdx = tracks.findIndex(
      (t) => t.bookId === target.bookId && t.chapter === target.chapter,
    );

    if (opts?.replace) {
      replaceReadPlanFlowChapterAudio(router, target);
    } else {
      pushReadPlanFlowChapter(router, target);
    }

    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    return scriptureChapterPool.playAt(startIdx >= 0 ? startIdx : 0, {
      startAtSec: opts?.startAtSec,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[planFlow] startTodayPlanFlowScripture failed", err);
    }
    return false;
  }
}

export async function startTodayReadingScriptureFromReadHome(
  router: Pick<Router, "push" | "replace">,
  opts?: StartTodayPlanFlowOpts,
): Promise<boolean> {
  try {
    const prefs = await readEffectiveReadingPlanPrefs();
    const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
    const readings = payload?.day?.readings ?? [];
    if (!readings.length) return false;
    const queue = buildPlanChapterQueue(readings);
    const start = await resolveTodayPlanScriptureStartTarget(queue);
    if (!start) return false;
    return startTodayPlanFlowScripture(router, start.target, {
      ...opts,
      startAtSec: start.startAtSec > 0 ? start.startAtSec : opts?.startAtSec,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[planFlow] startTodayReadingScriptureFromReadHome failed", err);
    }
    return false;
  }
}
