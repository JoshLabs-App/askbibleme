import { activateNtDeepRepeatPlan } from "@/lib/read/nt-deep-repeat-plan-sync";
import { readReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";

/** 从未保存过计划选择时：默认方法二深读，7 天/阶。 */
export function ensureDefaultReadingPlanIfUnset(): void {
  const stored = readReadingPlanPrefs();
  if (stored !== null) return;
  activateNtDeepRepeatPlan();
}
