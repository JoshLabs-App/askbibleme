import { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import {
  buildDefaultReadingPlanPrefs,
  readEffectiveReadingPlanPrefs,
  subscribeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "./reading-plan-prefs";
import {
  createDefaultTripleLoopReadingState,
  type TripleLoopReadingState,
} from "./triple-loop-reading";
import { normalizeTripleLoopChaptersReadKeys } from "./triple-loop-chapters-read";
import {
  readTripleLoopProgress,
  subscribeTripleLoopProgress,
} from "./triple-loop-progress";

export function useEffectiveReadingPlanPrefs(): {
  prefs: ReadingPlanPrefs;
  refresh: () => void;
} {
  const [prefs, setPrefs] = useState<ReadingPlanPrefs>(buildDefaultReadingPlanPrefs());

  const refresh = useCallback(() => {
    void readEffectiveReadingPlanPrefs().then((next) => {
      setPrefs((prev) =>
        prev.planId === next.planId &&
        prev.anchor === next.anchor &&
        prev.startedOn === next.startedOn &&
        prev.dayCount === next.dayCount &&
        prev.aheadDays === next.aheadDays
          ? prev
          : next,
      );
    });
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(refresh);
    const unsub = subscribeReadingPlanPrefs(refresh);
    return () => {
      task.cancel();
      unsub();
    };
  }, [refresh]);

  return { prefs, refresh };
}

export function useTripleLoopProgress(): {
  progress: TripleLoopReadingState;
  refresh: () => void;
} {
  const [progress, setProgress] = useState<TripleLoopReadingState>(createDefaultTripleLoopReadingState());

  const refresh = useCallback(() => {
    void readTripleLoopProgress().then((next) => {
      const keys = normalizeTripleLoopChaptersReadKeys(next.chaptersReadKeys);
      const keysSig = `${keys.ot.join(",")}|${keys.nt.join(",")}|${keys.wisdom.join(",")}`;
      setProgress((prev) => {
        const prevKeys = normalizeTripleLoopChaptersReadKeys(prev.chaptersReadKeys);
        const prevKeysSig = `${prevKeys.ot.join(",")}|${prevKeys.nt.join(",")}|${prevKeys.wisdom.join(",")}`;
        return prev.ot.bookId === next.ot.bookId &&
          prev.ot.chapter === next.ot.chapter &&
          prev.nt.bookId === next.nt.bookId &&
          prev.nt.chapter === next.nt.chapter &&
          prev.wisdom.bookId === next.wisdom.bookId &&
          prev.wisdom.chapter === next.wisdom.chapter &&
          prevKeysSig === keysSig
          ? prev
          : next;
      });
    });
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(refresh);
    const unsub = subscribeTripleLoopProgress(refresh);
    return () => {
      task.cancel();
      unsub();
    };
  }, [refresh]);

  return { progress, refresh };
}
