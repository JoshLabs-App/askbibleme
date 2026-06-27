import { t } from "../../i18n/site-copy";
import {
  buildNtDeepRepeatReadingPlanDay,
  isNtDeepRepeatPlanId,
  NT_DEEP_REPEAT_PLAN_DAY_COUNT,
  NT_DEEP_REPEAT_PLAN_ID,
} from "./nt-deep-repeat-plan";
import {
  buildTripleLoopReadingPlanDay,
  isTripleLoopPlanId,
  TRIPLE_LOOP_PLAN_DAY_COUNT,
} from "./triple-loop-plan";
import { fetchReadingPlanDay, type ReadingPlanDayPayload } from "./fetch-reading-plan-day";
import { resolveEffectiveReadingPlanDayIndex } from "./reading-plan-ahead";
import {
  type ReadingPlanPrefs,
} from "./reading-plan-prefs";
import { readNtDeepRepeatProgress } from "./nt-deep-repeat-progress";
import { readTripleLoopProgress } from "./triple-loop-progress";

export type TodayReadingPlanPayload = ReadingPlanDayPayload;

export async function buildTripleLoopDayPayload(): Promise<TodayReadingPlanPayload> {
  const progress = await readTripleLoopProgress();
  return {
    planId: "triple-loop",
    name: t("pages.read.plansCatalog.triple-loop.title"),
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
    dayIndex: 0,
    day: buildTripleLoopReadingPlanDay(progress),
  };
}

export async function buildNtDeepRepeatDayPayload(): Promise<TodayReadingPlanPayload> {
  const progress = await readNtDeepRepeatProgress();
  return {
    planId: NT_DEEP_REPEAT_PLAN_ID,
    name: t("pages.read.plansCatalog.nt-deep-repeat.title"),
    dayCount: NT_DEEP_REPEAT_PLAN_DAY_COUNT,
    dayIndex: 0,
    day: buildNtDeepRepeatReadingPlanDay(progress),
  };
}

/** 本机 prefs + 三轨进度 / 打包 plan JSON；不请求线上（每人进度不同）。 */
export async function loadTodayReadingPlanPayload(
  prefs: ReadingPlanPrefs,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (isTripleLoopPlanId(prefs.planId)) {
    return buildTripleLoopDayPayload();
  }
  if (isNtDeepRepeatPlanId(prefs.planId)) {
    return buildNtDeepRepeatDayPayload();
  }
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = resolveEffectiveReadingPlanDayIndex(prefs, dayCount);
  return fetchReadingPlanDay(prefs.planId, dayIndex);
}
