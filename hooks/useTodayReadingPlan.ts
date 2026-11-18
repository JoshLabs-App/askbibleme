"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  readAheadDays,
  resolveEffectiveEpochDay,
  resolveEffectiveReadingPlanDayIndex,
} from "@/lib/read/reading-plan-ahead";
import { resolveReadingPlanDayIndex } from "@/lib/read/reading-plan-prefs";
import {
  getEffectiveReadingPlanPrefsServerSnapshot,
  getEffectiveReadingPlanPrefsSnapshot,
  subscribeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  getTripleLoopProgressServerSnapshot,
  getTripleLoopProgressSnapshot,
  subscribeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";
import { loadTodayReadingPlanPayload, type TodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";
import { useSyncExternalStore } from "react";

export function planTitleKey(planId: string): string {
  return `pages.read.plansCatalog.${planId}.title`;
}

export function useTodayReadingPlan(registryPlans: ReadingPlanRegistryEntry[]) {
  const prefs = useSyncExternalStore(
    subscribeReadingPlanPrefs,
    getEffectiveReadingPlanPrefsSnapshot,
    getEffectiveReadingPlanPrefsServerSnapshot,
  );
  const progress = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );

  const registryById = useMemo(() => new Map(registryPlans.map((p) => [p.planId, p])), [registryPlans]);

  const [loaded, setLoaded] = useState<{
    prefs: typeof prefs;
    progressKey: string;
    payload: TodayReadingPlanPayload | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = registryById.get(prefs.planId)?.dayCount ?? prefs.dayCount;
  const aheadDays = readAheadDays(prefs);
  const calendarEpochDay = getReadingPlanDaySinceEpoch();
  const effectiveEpochDay = resolveEffectiveEpochDay(prefs);
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;
  const effectiveDayIndex =
    !isTripleLoop && dayCount ? resolveEffectiveReadingPlanDayIndex(prefs, dayCount) : null;

  const tripleProgressKey = isTripleLoop
    ? `${progress.ot.bookId}:${progress.ot.chapter}|${progress.nt.bookId}:${progress.nt.chapter}|${progress.wisdom.bookId}:${progress.wisdom.chapter}|a:${aheadDays}|r:${progress.chaptersRead?.ot ?? 0},${progress.chaptersRead?.nt ?? 0},${progress.chaptersRead?.wisdom ?? 0}`
    : `ahead:${aheadDays}`;

  useEffect(() => {
    let cancelled = false;
    if (!isTripleLoop && effectiveDayIndex == null) {
      setLoaded(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadTodayReadingPlanPayload(prefs, { dayCount: dayCount ?? undefined })
      .then((payload) => {
        if (!cancelled) setLoaded({ prefs, progressKey: tripleProgressKey, payload });
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [prefs, effectiveDayIndex, dayCount, isTripleLoop, tripleProgressKey]);

  // A new plan must not hand the previous plan's queue to the playback effects,
  // even during the render before the new request's effect starts.
  const payload = loaded?.prefs === prefs && loaded.progressKey === tripleProgressKey
    ? loaded.payload
    : null;

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
