import { useCallback, useEffect, useMemo, useState } from "react";
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
    refresh();
    return subscribeReadingHabitStats(refresh);
  }, [refresh]);

  const syncTodayComplete = useCallback(async (allDoneToday: boolean) => {
    const record = await syncReadingHabitDayCompletion(allDoneToday);
    setSnapshot(snapshotFromRecord(record));
  }, []);

  return { yearDay, snapshot, syncTodayComplete };
}
