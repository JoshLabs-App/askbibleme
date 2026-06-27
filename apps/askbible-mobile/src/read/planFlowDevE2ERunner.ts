import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Router } from "expo-router";
import { readEffectiveReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "../read/reading-plan/today-reading-plan-payload";
import {
  armReadPlanFlowAutoplay,
  armReadPlanFlowTodayLoop,
  beginPlanFlowChapterAdvance,
  endPlanFlowChapterAdvanceDeferred,
  markPlanFlowSessionActive,
  peekReadPlanFlowAutoplay,
  shouldLoopTodayPlanFlow,
} from "../read/read-plan-flow-autoplay";
import {
  buildPlanChapterQueue,
  replaceReadPlanFlowChapterAudio,
  resolvePlanFlowNextTarget,
} from "../read/read-plan-flow-nav";
import { startTodayReadingScriptureFromReadHome } from "../read/startTodayReadingScriptureFromReadHome";

const LOG = "[E2E-PlanFlow]";
export const RESULT_KEY = "askbible-e2e-plan-flow-result-v1";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeResult(status: "pass" | "fail", detail: string): Promise<void> {
  const payload = JSON.stringify({ status, detail, at: new Date().toISOString() });
  console.log(`${LOG} ${status.toUpperCase()} ${detail}`);
  try {
    await AsyncStorage.setItem(RESULT_KEY, payload);
  } catch {
    /* ignore */
  }
}

async function advancePlanFlowChapter(
  router: Pick<Router, "push" | "replace">,
  from: { bookId: string; chapter: number },
  to: { bookId: string; chapter: number },
): Promise<void> {
  beginPlanFlowChapterAdvance();
  try {
    armReadPlanFlowAutoplay();
    markPlanFlowSessionActive();
    armReadPlanFlowTodayLoop();
    replaceReadPlanFlowChapterAudio(router, to);
  } finally {
    endPlanFlowChapterAdvanceDeferred();
  }
  await sleep(from.bookId === to.bookId && from.chapter === to.chapter ? 2000 : 3500);
}

/** __DEV__：启动 planFlow、模拟章末 replace 续章，验证队列与 autoplay arm。 */
export async function runPlanFlowDevE2E(router: Pick<Router, "push" | "replace">): Promise<void> {
  if (!__DEV__) return;

  try {
    const prefs = await readEffectiveReadingPlanPrefs();
    const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
    const readings = payload?.day?.readings ?? [];
    const queue = buildPlanChapterQueue(readings);
    if (queue.length < 2) {
      await writeResult("fail", `need >=2 chapters, got ${queue.length}`);
      return;
    }

    const started = await startTodayReadingScriptureFromReadHome(router, {
      replace: true,
      loopTodayPlan: true,
    });
    if (!started) {
      await writeResult("fail", "startTodayReadingScriptureFromReadHome returned false");
      return;
    }

    if (!shouldLoopTodayPlanFlow()) {
      await writeResult("fail", "loopTodayPlan not armed");
      return;
    }

    await sleep(3500);

    let current = queue[0]!;
    const maxSteps = Math.min(queue.length, 4);
    for (let step = 1; step < maxSteps; step += 1) {
      const next = resolvePlanFlowNextTarget(payload, current.bookId, current.chapter);
      if (!next) {
        await writeResult("fail", `no next from ${current.bookId}:${current.chapter} at step ${step}`);
        return;
      }
      await advancePlanFlowChapter(router, current, next);
      current = next;
    }

    const loopBack = resolvePlanFlowNextTarget(payload, current.bookId, current.chapter);
    if (!loopBack) {
      await writeResult("fail", `loop target null after ${current.bookId}:${current.chapter}`);
      return;
    }

    const autoplayNote = peekReadPlanFlowAutoplay()
      ? "autoplay armed"
      : "autoplay consumed";
    await writeResult(
      "pass",
      `chain ${maxSteps} chapters ending ${current.bookId}:${current.chapter}; loop→${loopBack.bookId}:${loopBack.chapter} (${autoplayNote})`,
    );
  } catch (err) {
    await writeResult("fail", err instanceof Error ? err.message : String(err));
  }
}
