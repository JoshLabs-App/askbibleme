"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import {
  buildTodayReadingScopeKey,
  readTodayReadingDoneKeys,
  setTodayReadingItemDone,
  subscribeTodayReadingDone,
  todayReadingItemKey,
} from "@/lib/read/today-reading-done";
import type { TodayReadingPlanState } from "@/hooks/useTodayReadingPlan";

export function useTodayReadingDone(plan: TodayReadingPlanState) {
  const { prefs, isTripleLoop, effectiveDayIndex, effectiveEpochDay } = plan;

  const scopeKey = useMemo(
    () =>
      buildTodayReadingScopeKey({
        planId: prefs.planId,
        isTripleLoop,
        epochDay: effectiveEpochDay,
        dayIndex: effectiveDayIndex,
      }),
    [prefs.planId, isTripleLoop, effectiveEpochDay, effectiveDayIndex],
  );

  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    setDoneKeys(readTodayReadingDoneKeys(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    refresh();
    return subscribeTodayReadingDone(refresh);
  }, [refresh]);

  const isDone = useCallback(
    (r: ReadingPlanRange) => doneKeys.has(todayReadingItemKey(r, prefs.planId)),
    [doneKeys, prefs.planId],
  );

  const allDone = useCallback(
    (readings: ReadingPlanRange[]) =>
      readings.length > 0 && readings.every((r) => doneKeys.has(todayReadingItemKey(r, prefs.planId))),
    [doneKeys, prefs.planId],
  );

  const toggleDone = useCallback(
    (r: ReadingPlanRange) => {
      const key = todayReadingItemKey(r, prefs.planId);
      const next = setTodayReadingItemDone(scopeKey, key, !doneKeys.has(key));
      setDoneKeys(next);
    },
    [scopeKey, doneKeys, prefs.planId],
  );

  return { scopeKey, doneKeys, isDone, allDone, toggleDone };
}
