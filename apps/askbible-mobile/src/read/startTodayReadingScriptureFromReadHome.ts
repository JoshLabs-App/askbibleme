import type { Router } from "expo-router";
import { InteractionManager } from "react-native";
import { buildScriptureChapterPool } from "./build-scripture-chapter-pool";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { warmBundledScriptureChapterAudioUri } from "../audio/scriptureAudioPlayback";
import { prefetchTodayReadingPlanQueueAudio } from "./prefetch-plan-flow-chapter-audio";
import { readPlanFlowChapterAudioPrefs } from "./read-plan-flow-audio-prefs";
import { runPlanFlowEntryCallback } from "./read-plan-flow-autoplay";
import { readEffectiveReadingPlanPrefs } from "./reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { readTodayPlanScriptureResume, resolveTodayPlanScriptureStartTargetFromSaved } from "./today-plan-scripture-resume";
import { primeTodayReadingPlanPayload } from "./today-reading-plan-payload-prime";
import {
  buildPlanChapterQueue,
  pushReadPlanFlowChapter,
  replaceReadPlanFlowChapterAudio,
  type PlanChapterRef,
} from "./read-plan-flow-nav";
import { resolveBundledChapterAudioModule } from "../bible/bundled-chapter-audio";
import { resolveLocalTodayReadingScopeKeyFromPrefs } from "./reading-plan/today-reading-done";

export type StartTodayPlanFlowOpts = {
  loopTodayPlan?: boolean;
  replace?: boolean;
  startAtSec?: number;
  quickStart?: boolean;
};

type PreparedPlanFlow = {
  queue: PlanChapterRef[];
  audioPrefs: Awaited<ReturnType<typeof readPlanFlowChapterAudioPrefs>>;
};

async function startTodayPlanFlowScripturePrepared(
  router: Pick<Router, "push" | "replace">,
  target: PlanChapterRef,
  opts: StartTodayPlanFlowOpts | undefined,
  prepared: PreparedPlanFlow,
): Promise<boolean> {
  try {
    runPlanFlowEntryCallback();

    const quickStart = opts?.quickStart === true;
    if (__DEV__ || quickStart) {
      console.warn(
        "[planFlow] start",
        target.bookId,
        target.chapter,
        quickStart ? "quick" : "full",
        "queue",
        prepared.queue.length,
      );
    }
    if (!quickStart) {
      await prefetchTodayReadingPlanQueueAudio(prepared.queue, {
        translationId: prepared.audioPrefs.translationId,
        voiceId: prepared.audioPrefs.voiceId,
        awaitFirst: true,
      });
    }

    const targetBundledModule = resolveBundledChapterAudioModule({
      translationId: prepared.audioPrefs.translationId,
      bookId: target.bookId,
      chapter: target.chapter,
      voiceId: prepared.audioPrefs.voiceId,
    });
    if (quickStart && targetBundledModule != null) {
      void warmBundledScriptureChapterAudioUri(targetBundledModule);
    }

    const tracks = await buildScriptureChapterPool(
      prepared.queue,
      prepared.audioPrefs.translationId,
      prepared.audioPrefs.voiceId,
      { lazySrc: quickStart },
    );
    if (!tracks.length) return false;

    const loopTodayPlan = opts?.loopTodayPlan !== false;
    scriptureChapterPool.load(tracks, { loop: loopTodayPlan });

    const startIdx = tracks.findIndex(
      (t) => t.bookId === target.bookId && t.chapter === target.chapter,
    );

    if (!quickStart) {
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
    }

    const started = await scriptureChapterPool.playAt(startIdx >= 0 ? startIdx : 0, {
      startAtSec: opts?.startAtSec,
      skipNavigate: quickStart,
      maxAttempts: quickStart ? 2 : 4,
      retryDelayMs: quickStart ? 150 : 450,
    });
    if (started && quickStart) {
      if (opts?.replace) {
        replaceReadPlanFlowChapterAudio(router, target);
      } else {
        pushReadPlanFlowChapter(router, target);
      }
    }
    if (__DEV__ || quickStart) {
      console.warn(
        "[planFlow] started",
        target.bookId,
        target.chapter,
        quickStart ? "quick" : "full",
        started ? "ok" : "fail",
      );
    }
    if (started && quickStart) {
      void prefetchTodayReadingPlanQueueAudio(prepared.queue.slice(1), {
        translationId: prepared.audioPrefs.translationId,
        voiceId: prepared.audioPrefs.voiceId,
        awaitFirst: false,
      });
    }
    return started;
  } catch (err) {
    if (__DEV__) {
      console.warn("[planFlow] startTodayPlanFlowScripturePrepared failed", err);
    }
    return false;
  }
}

/** 进入今日 planFlow：预载队列 → 建播放池 → 导航 → playAt（音乐列表同款）。 */
export async function startTodayPlanFlowScripture(
  router: Pick<Router, "push" | "replace">,
  target: PlanChapterRef,
  opts?: StartTodayPlanFlowOpts,
): Promise<boolean> {
  try {
    if (__DEV__ || opts?.quickStart) {
      console.warn("[planFlow] entry", target.bookId, target.chapter, opts?.quickStart ? "quick" : "full");
    }
    const prefs = await readEffectiveReadingPlanPrefs();
    const payloadPromise = loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
    const audioPrefsPromise = readPlanFlowChapterAudioPrefs();
    const payload = await payloadPromise;
    const readings = payload?.day?.readings ?? [];
    if (!readings.length) return false;
    const queue = buildPlanChapterQueue(readings);
    if (!queue.some((ref) => ref.bookId === target.bookId && ref.chapter === target.chapter)) {
      return false;
    }
    primeTodayReadingPlanPayload(payload);
    const audioPrefs = await audioPrefsPromise;
    return startTodayPlanFlowScripturePrepared(router, target, opts, {
      queue,
      audioPrefs,
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
    if (__DEV__ || opts?.quickStart) {
      console.warn("[planFlow] read-home entry", opts?.quickStart ? "quick" : "full");
    }
    const prefs = await readEffectiveReadingPlanPrefs();
    const payloadPromise = loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
    const audioPrefsPromise = readPlanFlowChapterAudioPrefs();
    const savedResumePromise = readTodayPlanScriptureResume();
    const payload = await payloadPromise;
    const readings = payload?.day?.readings ?? [];
    if (!readings.length) return false;
    const queue = buildPlanChapterQueue(readings);
    const scopeKey = resolveLocalTodayReadingScopeKeyFromPrefs(prefs);
    const [audioPrefs, savedResume] = await Promise.all([audioPrefsPromise, savedResumePromise]);
    const start = resolveTodayPlanScriptureStartTargetFromSaved(queue, scopeKey, savedResume);
    if (!start) return false;
    primeTodayReadingPlanPayload(payload);
    return startTodayPlanFlowScripturePrepared(router, start.target, {
      ...opts,
      startAtSec: start.startAtSec > 0 ? start.startAtSec : opts?.startAtSec,
    }, {
      queue,
      audioPrefs,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[planFlow] startTodayReadingScriptureFromReadHome failed", err);
    }
    return false;
  }
}
