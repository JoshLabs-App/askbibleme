import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { isNtDeepRepeatPlanId } from "./reading-plan/nt-deep-repeat-plan";
import { isPointerReadingPlanId } from "./reading-plan/pointer-reading-plan";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";
import { getReadingPlanDaySinceEpoch } from "./reading-plan/reading-plan-epoch";
import {
  readAheadDays,
  resolveEffectiveEpochDay,
  resolveEffectiveReadingPlanDayIndex,
} from "./reading-plan/reading-plan-ahead";
import { resolveReadingPlanDayIndex } from "./reading-plan/reading-plan-prefs";
import {
  loadTodayReadingPlanPayload,
  todayReadingPayloadMatchesPrefs,
  type TodayReadingPlanPayload,
} from "./reading-plan/today-reading-plan-payload";
import {
  clearPrimedTodayReadingPlanPayload,
  peekPrimedTodayReadingPlanPayload,
} from "./today-reading-plan-payload-prime";
import {
  useEffectiveReadingPlanPrefs,
  useNtDeepRepeatProgress,
  useTripleLoopProgress,
} from "./reading-plan/useReadingPlanStores";

function planTitleKey(planId: string): string {
  return `pages.read.plansCatalog.${planId}.title`;
}

export function useTodayReadingPlan(
  registryPlans: ReadingPlanRegistryEntry[],
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const { prefs } = useEffectiveReadingPlanPrefs();
  const { progress: tripleProgress } = useTripleLoopProgress();
  const { progress: ntDeepProgress } = useNtDeepRepeatProgress();

  const registryById = useMemo(() => new Map(registryPlans.map((p) => [p.planId, p])), [registryPlans]);

  const [payload, setPayload] = useState<TodayReadingPlanPayload | null>(() =>
    enabled ? peekPrimedTodayReadingPlanPayload() : null,
  );
  const [loading, setLoading] = useState(false);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const isNtDeepRepeat = isNtDeepRepeatPlanId(prefs.planId);
  const isPointerPlan = isPointerReadingPlanId(prefs.planId);
  const dayCount = registryById.get(prefs.planId)?.dayCount ?? prefs.dayCount;
  const aheadDays = readAheadDays(prefs);
  const calendarEpochDay = getReadingPlanDaySinceEpoch();
  const effectiveEpochDay = resolveEffectiveEpochDay(prefs);
  const dayIndex = !isPointerPlan && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;
  const effectiveDayIndex =
    !isPointerPlan && dayCount ? resolveEffectiveReadingPlanDayIndex(prefs, dayCount) : null;

  const loadToday = useCallback(async () => {
    if (!isPointerPlan && effectiveDayIndex == null) {
      setPayload(null);
      setLoading(false);
      return;
    }
    if (payloadRef.current == null) setLoading(true);
    try {
      const j = await loadTodayReadingPlanPayload(prefs, { dayCount: dayCount ?? undefined });
      if (j?.day?.readings?.length) {
        clearPrimedTodayReadingPlanPayload();
      }
      setPayload(j);
    } catch {
      const primed = peekPrimedTodayReadingPlanPayload();
      setPayload((prev) => primed ?? prev);
    } finally {
      setLoading(false);
    }
  }, [prefs.planId, prefs.anchor, prefs.startedOn, prefs.dayCount, prefs.aheadDays, effectiveDayIndex, dayCount, isPointerPlan, calendarEpochDay]);

  const tripleProgressKey = isTripleLoop
    ? `${tripleProgress.ot.bookId}:${tripleProgress.ot.chapter}|${tripleProgress.nt.bookId}:${tripleProgress.nt.chapter}|${tripleProgress.wisdom.bookId}:${tripleProgress.wisdom.chapter}|a:${aheadDays}|r:${tripleProgress.chaptersRead?.ot ?? 0},${tripleProgress.chaptersRead?.nt ?? 0},${tripleProgress.chaptersRead?.wisdom ?? 0}`
    : `ahead:${aheadDays}`;
  const ntDeepProgressKey = isNtDeepRepeat
    ? `${ntDeepProgress.ot.bookId}:${ntDeepProgress.ot.chapter}|i:${ntDeepProgress.curriculumIndex}|d:${ntDeepProgress.dayInSegment}|a:${aheadDays}`
    : tripleProgressKey;

  useEffect(() => {
    setPayload((prev) => (prev && !todayReadingPayloadMatchesPrefs(prev, prefs) ? null : prev));
  }, [prefs.planId, prefs.anchor, prefs.startedOn, prefs.aheadDays]);

  useEffect(() => {
    if (!enabled) return;
    const primed = peekPrimedTodayReadingPlanPayload();
    if (primed && todayReadingPayloadMatchesPrefs(primed, prefs)) {
      setPayload(primed);
    }
    const task = InteractionManager.runAfterInteractions(() => {
      void loadToday();
    });
    return () => task.cancel();
  }, [enabled, loadToday, ntDeepProgressKey, prefs.planId]);

  return {
    prefs,
    payload: payload && todayReadingPayloadMatchesPrefs(payload, prefs) ? payload : null,
    loading,
    isTripleLoop,
    isNtDeepRepeat,
    isPointerPlan,
    dayCount,
    aheadDays,
    dayIndex,
    effectiveDayIndex,
    calendarEpochDay,
    effectiveEpochDay,
    epochDay: effectiveEpochDay,
  };
}

export type TodayReadingPlanState = ReturnType<typeof useTodayReadingPlan>;

export { planTitleKey };
