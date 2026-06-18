import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
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
  type TodayReadingPlanPayload,
} from "./reading-plan/today-reading-plan-payload";
import {
  useEffectiveReadingPlanPrefs,
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
  const { progress } = useTripleLoopProgress();

  const registryById = useMemo(() => new Map(registryPlans.map((p) => [p.planId, p])), [registryPlans]);

  const [payload, setPayload] = useState<TodayReadingPlanPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = registryById.get(prefs.planId)?.dayCount ?? prefs.dayCount;
  const aheadDays = readAheadDays(prefs);
  const calendarEpochDay = getReadingPlanDaySinceEpoch();
  const effectiveEpochDay = resolveEffectiveEpochDay(prefs);
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;
  const effectiveDayIndex =
    !isTripleLoop && dayCount ? resolveEffectiveReadingPlanDayIndex(prefs, dayCount) : null;

  const loadToday = useCallback(async () => {
    if (!isTripleLoop && effectiveDayIndex == null) {
      setPayload(null);
      setLoading(false);
      return;
    }
    if (payloadRef.current == null) setLoading(true);
    try {
      const j = await loadTodayReadingPlanPayload(prefs, { dayCount: dayCount ?? undefined });
      setPayload(j);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [prefs.planId, prefs.anchor, prefs.startedOn, prefs.dayCount, prefs.aheadDays, effectiveDayIndex, dayCount, isTripleLoop]);

  const tripleProgressKey = isTripleLoop
    ? `${progress.ot.bookId}:${progress.ot.chapter}|${progress.nt.bookId}:${progress.nt.chapter}|${progress.wisdom.bookId}:${progress.wisdom.chapter}|a:${aheadDays}|r:${progress.chaptersRead?.ot ?? 0},${progress.chaptersRead?.nt ?? 0},${progress.chaptersRead?.wisdom ?? 0}`
    : `ahead:${aheadDays}`;

  useEffect(() => {
    if (!enabled) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadToday();
    });
    return () => task.cancel();
  }, [enabled, loadToday, tripleProgressKey]);

  return {
    prefs,
    payload,
    loading,
    isTripleLoop,
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
