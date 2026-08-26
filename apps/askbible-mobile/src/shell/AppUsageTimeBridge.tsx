import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  flushAppUsageTick,
  hydrateAppUsageTime,
  noteAppUsageBackground,
  noteAppUsageForeground,
} from "./app-usage-time";

const FLUSH_INTERVAL_MS = 15_000;

function noteHabitDayOnOpen() {
  void import("../read/reading-habit-stats").then(({ touchReadingHabitDay }) => {
    void touchReadingHabitDay();
  });
}

/** 全局累计 App 前台使用时长（本地持久化）。打开 App 也记入连续天。 */
export function AppUsageTimeBridge() {
  useEffect(() => {
    void hydrateAppUsageTime().then(() => {
      if (AppState.currentState === "active") {
        noteAppUsageForeground();
        noteHabitDayOnOpen();
      }
    });

    const onChange = (state: AppStateStatus) => {
      if (state === "active") {
        noteAppUsageForeground();
        noteHabitDayOnOpen();
        return;
      }
      noteAppUsageBackground();
    };

    const sub = AppState.addEventListener("change", onChange);
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        flushAppUsageTick();
        noteHabitDayOnOpen();
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      sub.remove();
      clearInterval(timer);
      noteAppUsageBackground();
    };
  }, []);

  return null;
}
