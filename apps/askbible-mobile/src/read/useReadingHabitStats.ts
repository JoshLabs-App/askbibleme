import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import {
  readReadingHabitStats,
  snapshotFromRecord,
  subscribeReadingHabitStats,
  syncReadingHabitDayCompletion,
  type ReadingHabitStatsSnapshot,
} from "./reading-habit-stats";
import { getYearDayTimeline } from "./year-day-timeline";

export function useReadingHabitStats() {
  const [snapshot, setSnapshot] = useState<ReadingHabitStatsSnapshot>({
    readDays: 0,
    streakDays: 0,
  });

  const yearDay = useMemo(() => getYearDayTimeline().dayOfYear, []);

  const refresh = useCallback(() => {
    void readReadingHabitStats().then((record) => {
      setSnapshot(snapshotFromRecord(record));
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
    setSnapshot(snapshotFromRecord(record));
  }, []);

  return { yearDay, snapshot, syncTodayComplete };
}
