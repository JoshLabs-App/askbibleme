import { t } from "../../i18n/site-copy";
import {
  buildNtDeepRepeatReadingPlanDay,
  isNtDeepRepeatPlanId,
  NT_DEEP_REPEAT_PLAN_DAY_COUNT,
  NT_DEEP_REPEAT_PLAN_ID,
} from "./nt-deep-repeat-plan";
import { resolveNtDeepRepeatPlanDay } from "./nt-deep-repeat-plan-day";
import { ntDeepRepeatStateForPlanDay } from "./nt-deep-repeat-reading";
import {
  buildTripleLoopReadingPlanDay,
  isTripleLoopPlanId,
  TRIPLE_LOOP_PLAN_DAY_COUNT,
} from "./triple-loop-plan";
import { tripleLoopStateForPlanDay } from "./triple-loop-reading";
import { fetchReadingPlanDay, type ReadingPlanDayPayload } from "./fetch-reading-plan-day";
import {
  readAheadDays,
  resolveEffectiveReadingPlanDayIndex,
} from "./reading-plan-ahead";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  resolveReadingPlanDayIndex,
  type ReadingPlanPrefs,
} from "./reading-plan-prefs";
import { readNtDeepRepeatProgress } from "./nt-deep-repeat-progress";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "./nt-deep-repeat-pace";

export type TodayReadingPlanPayload = ReadingPlanDayPayload;

export function buildTripleLoopDayPayload(prefs?: ReadingPlanPrefs): TodayReadingPlanPayload {
  const ahead = prefs ? readAheadDays(prefs) : 0;
  const planDay = Math.max(1, getReadingPlanDaySinceEpoch() + ahead);
  return {
    planId: "triple-loop",
    name: t("pages.read.plansCatalog.triple-loop.title"),
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
    dayIndex: Math.max(0, planDay - 1),
    day: buildTripleLoopReadingPlanDay(tripleLoopStateForPlanDay(planDay)),
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

/** 今日列表必须和当前计划一致，避免同步后标题/列表/版块各读各的缓存。 */
export function todayReadingPayloadMatchesPrefs(
  payload: TodayReadingPlanPayload | null | undefined,
  prefs: ReadingPlanPrefs,
): boolean {
  if (!payload?.planId?.trim() || !prefs?.planId?.trim()) return false;
  if (isTripleLoopPlanId(prefs.planId)) return isTripleLoopPlanId(payload.planId);
  if (isNtDeepRepeatPlanId(prefs.planId)) return isNtDeepRepeatPlanId(payload.planId);
  return payload.planId === prefs.planId;
}

/** 本机 prefs + 三轨进度 / 打包 plan JSON；不请求线上（每人进度不同）。 */
export async function loadTodayReadingPlanPayload(
  prefs: ReadingPlanPrefs,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (!prefs?.planId?.trim()) return null;
  if (isTripleLoopPlanId(prefs.planId)) {
    return buildTripleLoopDayPayload(prefs);
  }
  if (isNtDeepRepeatPlanId(prefs.planId)) {
    return buildNtDeepRepeatDayPayload();
  }
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = resolveEffectiveReadingPlanDayIndex(prefs, dayCount);
  return fetchReadingPlanDay(prefs.planId, dayIndex);
}

/**
 * 按相对今天的天数预览某日读经（不写 prefs）。
 * `viewAhead=0` 为日历今天；负数回看过去；与已提交 aheadDays 相同时等同今日有效进度。
 */
export async function loadReadingPlanPayloadAtAhead(
  prefs: ReadingPlanPrefs,
  viewAhead: number,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (!prefs?.planId?.trim()) return null;
  const ahead = Number.isFinite(viewAhead) ? Math.floor(viewAhead) : 0;

  if (isTripleLoopPlanId(prefs.planId)) {
    const planDay = Math.max(1, getReadingPlanDaySinceEpoch() + ahead);
    return {
      planId: "triple-loop",
      name: t("pages.read.plansCatalog.triple-loop.title"),
      dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
      dayIndex: Math.max(0, planDay - 1),
      day: buildTripleLoopReadingPlanDay(tripleLoopStateForPlanDay(planDay)),
    };
  }

  if (ahead === readAheadDays(prefs)) {
    return loadTodayReadingPlanPayload(prefs, opts);
  }

  if (isNtDeepRepeatPlanId(prefs.planId)) {
    const planDay = Math.max(1, resolveNtDeepRepeatPlanDay(prefs) + ahead);
    const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
    const startedAt = prefs.startedOn?.trim();
    const progress = ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt });
    return {
      planId: NT_DEEP_REPEAT_PLAN_ID,
      name: t("pages.read.plansCatalog.nt-deep-repeat.title"),
      dayCount: NT_DEEP_REPEAT_PLAN_DAY_COUNT,
      dayIndex: Math.max(0, planDay - 1),
      day: buildNtDeepRepeatReadingPlanDay(progress),
    };
  }

  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, dayCount);
  const dayIndex = Math.max(0, Math.min(dayCount - 1, calendarIndex + ahead));
  return fetchReadingPlanDay(prefs.planId, dayIndex);
}
