"use client";

import { useCallback, useEffect, useState } from "react";
import type { TodayReadingPlanState } from "@/hooks/useTodayReadingPlan";
import { useTodayReadingDone } from "@/hooks/useTodayReadingDone";
import {
  readTodayReadingChapterFractions,
  subscribeTodayReadingChapterFraction,
} from "@/lib/read/today-reading-chapter-fraction";
import {
  getTripleLoopProgressServerSnapshot,
  getTripleLoopProgressSnapshot,
  subscribeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";
import { useSyncExternalStore } from "react";

export function useTodayReadingChapterFractions(plan: TodayReadingPlanState) {
  const { isTripleLoop } = plan;
  const { scopeKey } = useTodayReadingDone(plan);
  const tripleCurrent = useSyncExternalStore(
    subscribeTripleLoopProgress,
    getTripleLoopProgressSnapshot,
    getTripleLoopProgressServerSnapshot,
  );
  const [fractions, setFractions] = useState<Record<string, number>>({});

  const tripleProgressKey = isTripleLoop
    ? `${tripleCurrent.ot.bookId}:${tripleCurrent.ot.chapter}|${tripleCurrent.nt.bookId}:${tripleCurrent.nt.chapter}|${tripleCurrent.wisdom.bookId}:${tripleCurrent.wisdom.chapter}`
    : "";

  const refreshFractions = useCallback(() => {
    setFractions(readTodayReadingChapterFractions(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    refreshFractions();
    return subscribeTodayReadingChapterFraction(refreshFractions);
  }, [refreshFractions, tripleProgressKey]);

  return {
    fractions,
    tripleCurrent: isTripleLoop ? tripleCurrent : null,
    tripleProgressKey,
  };
}
