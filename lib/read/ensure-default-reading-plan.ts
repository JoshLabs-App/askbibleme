import { NT_DEEP_REPEAT_DEFAULT_PACE } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { NT_DEEP_REPEAT_PLAN_ID } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import {
  buildDefaultReadingPlanPrefs,
  readReadingPlanPrefs,
  writeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";

function isUnchosenNtDeepRepeatBootstrap(prefs: ReadingPlanPrefs): boolean {
  if (prefs.chosen === true) return false;
  if ((prefs.aheadDays ?? 0) > 0) return false;
  if (prefs.planId !== NT_DEEP_REPEAT_PLAN_ID || prefs.anchor !== "from-today") return false;
  const pace = prefs.ntDeepRepeatPace;
  return pace == null || pace === NT_DEEP_REPEAT_DEFAULT_PACE;
}

/** 从未保存过计划选择时：默认轻松循环读经。不带 chosen，避免盖掉云端已选计划。 */
export function ensureDefaultReadingPlanIfUnset(): void {
  const stored = readReadingPlanPrefs();
  if (stored !== null && !isUnchosenNtDeepRepeatBootstrap(stored)) return;
  writeReadingPlanPrefs(buildDefaultReadingPlanPrefs());
}
