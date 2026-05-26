import { t } from "../../i18n/site-copy";
import {
  buildTripleLoopReadingPlanDay,
  isTripleLoopPlanId,
  TRIPLE_LOOP_PLAN_DAY_COUNT,
} from "./triple-loop-plan";
import { fetchReadingPlanDay, type ReadingPlanDayPayload } from "./fetch-reading-plan-day";
import {
  resolveReadingPlanDayIndex,
  type ReadingPlanPrefs,
} from "./reading-plan-prefs";
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

/** 本机 prefs + 三轨进度 / 打包 plan JSON；不请求线上（每人进度不同）。 */
export async function loadTodayReadingPlanPayload(
  prefs: ReadingPlanPrefs,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (isTripleLoopPlanId(prefs.planId)) {
    return buildTripleLoopDayPayload();
  }
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = resolveReadingPlanDayIndex(prefs, dayCount);
  return fetchReadingPlanDay(prefs.planId, dayIndex);
}
