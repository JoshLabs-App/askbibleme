"use client";

import { useEffect } from "react";
import { subscribeReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";
import {
  ensureDefaultReadingPlanIfUnset,
} from "@/lib/read/ensure-default-reading-plan";
import { syncTripleLoopPlanPrefsIfNeeded } from "@/lib/read/triple-loop-plan-sync";

/** 读经分区挂载时对齐三轨循环计划 prefs（复活节历元）。 */
export function ReadTripleLoopPlanSync() {
  useEffect(() => {
    ensureDefaultReadingPlanIfUnset();
    syncTripleLoopPlanPrefsIfNeeded();
    return subscribeReadingPlanPrefs(() => {
      syncTripleLoopPlanPrefsIfNeeded();
    });
  }, []);

  return null;
}
