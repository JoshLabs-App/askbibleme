import { activateNtDeepRepeatPlan } from "./nt-deep-repeat-plan-sync";
import { readReadingPlanPrefs } from "./reading-plan-prefs";

/** 从未保存过计划选择时：默认方法二深读，7 天/阶。 */
export async function ensureDefaultReadingPlanIfUnset(): Promise<void> {
  const stored = await readReadingPlanPrefs();
  if (stored !== null) return;
  await activateNtDeepRepeatPlan();
}
