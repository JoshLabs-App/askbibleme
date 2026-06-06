"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
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
  }, [prefs, dayIndex, dayCount, isTripleLoop]);

  const tripleProgressKey = isTripleLoop
    ? `${progress.ot.bookId}:${progress.ot.chapter}|${progress.nt.bookId}:${progress.nt.chapter}|${progress.wisdom.bookId}:${progress.wisdom.chapter}|r:${progress.chaptersRead?.ot ?? 0},${progress.chaptersRead?.nt ?? 0},${progress.chaptersRead?.wisdom ?? 0}`
    : "";

  useEffect(() => {
    void loadToday();
  }, [loadToday, tripleProgressKey]);

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
