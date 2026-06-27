"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getYearDayTimeline } from "@/lib/read/year-day-timeline";
import {
  readReadingHabitStats,
  snapshotFromRecord,
  subscribeReadingHabitStats,
  syncReadingHabitDayCompletion,
  type ReadingHabitStatsSnapshot,
} from "@/lib/read/reading-habit-stats";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";

export function useReadingHabitStats() {
  const yearDay = useMemo(() => getYearDayTimeline().dayOfYear, []);
  const [snapshot, setSnapshot] = useState<ReadingHabitStatsSnapshot>(() =>
    snapshotFromRecord(readReadingHabitStats(), toLocalDateString(new Date())),
  );

  const refresh = useCallback(() => {
    setSnapshot(snapshotFromRecord(readReadingHabitStats(), toLocalDateString(new Date())));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeReadingHabitStats(refresh);
  }, [refresh]);

  const syncTodayComplete = useCallback(async (hasReadingToday: boolean | undefined) => {
    const next = syncReadingHabitDayCompletion(hasReadingToday);
    setSnapshot(snapshotFromRecord(next, toLocalDateString(new Date())));
  }, []);

  return { yearDay, snapshot, syncTodayComplete };
}
