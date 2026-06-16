import { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import {
  readTodayReadingChapterFractions,
  subscribeTodayReadingChapterFraction,
} from "./reading-plan/today-reading-chapter-fraction";
import type { TodayReadingPlanState } from "./useTodayReadingPlan";
import { useTripleLoopProgress } from "./reading-plan/useReadingPlanStores";
import { useTodayReadingDone } from "./useTodayReadingDone";

export function useTodayReadingChapterFractions(plan: TodayReadingPlanState) {
  const { isTripleLoop } = plan;
  const { scopeKey } = useTodayReadingDone(plan);
  const { progress: tripleCurrent } = useTripleLoopProgress();
  const [fractions, setFractions] = useState<Record<string, number>>({});

  const tripleProgressKey = isTripleLoop
    ? `${tripleCurrent.ot.bookId}:${tripleCurrent.ot.chapter}|${tripleCurrent.nt.bookId}:${tripleCurrent.nt.chapter}|${tripleCurrent.wisdom.bookId}:${tripleCurrent.wisdom.chapter}`
    : "";

  const refreshFractions = useCallback(() => {
    void readTodayReadingChapterFractions(scopeKey).then(setFractions);
  }, [scopeKey]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(refreshFractions);
    const unsub = subscribeTodayReadingChapterFraction(refreshFractions);
    return () => {
      task.cancel();
      unsub();
    };
  }, [refreshFractions]);

  return {
    fractions,
    tripleCurrent: isTripleLoop ? tripleCurrent : null,
    tripleProgressKey,
  };
}
