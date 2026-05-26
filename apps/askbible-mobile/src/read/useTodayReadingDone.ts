import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTodayReadingScopeKey,
  readTodayReadingDoneKeys,
  setTodayReadingItemDone,
  subscribeTodayReadingDone,
  todayReadingItemKey,
} from "./reading-plan/today-reading-done";
import type { ReadingPlanRange } from "./reading-plan/types";
import type { TodayReadingPlanState } from "./useTodayReadingPlan";

export function useTodayReadingDone(plan: TodayReadingPlanState) {
  const { prefs, isTripleLoop, dayIndex, epochDay } = plan;

  const scopeKey = useMemo(
    () =>
      buildTodayReadingScopeKey({
        planId: prefs.planId,
        isTripleLoop,
        epochDay,
        dayIndex,
      }),
    [prefs.planId, isTripleLoop, epochDay, dayIndex],
  );

  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    void readTodayReadingDoneKeys(scopeKey).then(setDoneKeys);
  }, [scopeKey]);

  useEffect(() => {
    refresh();
    return subscribeTodayReadingDone(refresh);
  }, [refresh]);

  const isDone = useCallback((r: ReadingPlanRange) => doneKeys.has(todayReadingItemKey(r)), [doneKeys]);

  const allDone = useCallback(
    (readings: ReadingPlanRange[]) =>
      readings.length > 0 && readings.every((r) => doneKeys.has(todayReadingItemKey(r))),
    [doneKeys],
  );

  const toggleDone = useCallback(
    async (r: ReadingPlanRange) => {
      const key = todayReadingItemKey(r);
      const next = await setTodayReadingItemDone(scopeKey, key, !doneKeys.has(key));
      setDoneKeys(next);
    },
    [scopeKey, doneKeys],
  );

  const markDone = useCallback(
    async (r: ReadingPlanRange) => {
      const key = todayReadingItemKey(r);
      if (doneKeys.has(key)) return;
      const next = await setTodayReadingItemDone(scopeKey, key, true);
      setDoneKeys(next);
    },
    [scopeKey, doneKeys],
  );

  return { scopeKey, doneKeys, isDone, allDone, toggleDone, markDone };
}
