import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { InteractionManager } from "react-native";
import {
  getCachedReadingHabitCompletedDates,
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
  const [completedDates, setCompletedDates] = useState<readonly string[]>(
    getCachedReadingHabitCompletedDates,
  );

  const yearDay = useMemo(() => getYearDayTimeline().dayOfYear, []);

  const refresh = useCallback(() => {
    void readReadingHabitStats().then((record) => {
      applySnapshot(setSnapshot, snapshotFromRecord(record));
      setCompletedDates(record.completedDates);
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

  const syncTodayComplete = useCallback(async (hasReadingToday: boolean | undefined) => {
    const record = await syncReadingHabitDayCompletion(hasReadingToday);
    applySnapshot(setSnapshot, snapshotFromRecord(record));
    setCompletedDates(record.completedDates);
  }, []);

  return { yearDay, snapshot, completedDates, syncTodayComplete };
}
