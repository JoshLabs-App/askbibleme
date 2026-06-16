import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";
import { getReadingPlanDaySinceEpoch } from "./reading-plan/reading-plan-epoch";
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

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = registryById.get(prefs.planId)?.dayCount ?? prefs.dayCount;
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;

  const loadToday = useCallback(async () => {
    if (!isTripleLoop && dayIndex == null) {
      setPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const j = await loadTodayReadingPlanPayload(prefs, { dayCount: dayCount ?? undefined });
      setPayload(j);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [prefs.planId, prefs.anchor, prefs.startedOn, prefs.dayCount, dayIndex, dayCount, isTripleLoop]);

  const tripleProgressKey = isTripleLoop
    ? `${progress.ot.bookId}:${progress.ot.chapter}|${progress.nt.bookId}:${progress.nt.chapter}|${progress.wisdom.bookId}:${progress.wisdom.chapter}|r:${progress.chaptersRead?.ot ?? 0},${progress.chaptersRead?.nt ?? 0},${progress.chaptersRead?.wisdom ?? 0}`
    : "";

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
    dayIndex,
    epochDay: getReadingPlanDaySinceEpoch(),
  };
}

export type TodayReadingPlanState = ReturnType<typeof useTodayReadingPlan>;

export { planTitleKey };
