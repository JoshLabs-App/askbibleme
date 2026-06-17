import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { InteractionManager } from "react-native";
import {
  getCachedReadingHabitStatsSnapshot,
  readReadingHabitStats,
  readingHabitStatsSnapshotsEqual,
  snapshotFromRecord,
  subscribeReadingHabitStats,
  syncReadingHabitDayCompletion,
  type ReadingHabitStatsSnapshot,
} from "./reading-habit-stats";
import { getYearDayTimeline } from "./year-day-timeline";

function applySnapshot(
  setSnapshot: Dispatch<SetStateAction<ReadingHabitStatsSnapshot>>,
  next: ReadingHabitStatsSnapshot,
) {
  setSnapshot((prev) => (readingHabitStatsSnapshotsEqual(prev, next) ? prev : next));
}

export function useReadingHabitStats() {
  const [snapshot, setSnapshot] = useState(getCachedReadingHabitStatsSnapshot);

  const yearDay = useMemo(() => getYearDayTimeline().dayOfYear, []);

  const refresh = useCallback(() => {
    void readReadingHabitStats().then((record) => {
      applySnapshot(setSnapshot, snapshotFromRecord(record));
    });
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(refresh);
    const unsub = subscribeReadingHabitStats(refresh);
    return () => {
      task.cancel();
      unsub();
    };
  }, [refresh]);

  const syncTodayComplete = useCallback(async (allDoneToday: boolean) => {
    const record = await syncReadingHabitDayCompletion(allDoneToday);
    applySnapshot(setSnapshot, snapshotFromRecord(record));
  }, []);

  return { yearDay, snapshot, syncTodayComplete };
}
