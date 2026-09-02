import { NT_DEEP_REPEAT_PLAN_ID } from "./nt-deep-repeat-plan";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  buildDefaultReadingPlanPrefs,
  readReadingPlanPrefs,
  writeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "./reading-plan-prefs";

/** 冷启动误写入的正式研读（无 chosen）可改回产品默认轻松循环。 */
function isUnchosenNtDeepRepeatBootstrap(prefs: ReadingPlanPrefs): boolean {
  if (prefs.chosen === true) return false;
  if ((prefs.aheadDays ?? 0) > 0) return false;
  if (prefs.planId !== NT_DEEP_REPEAT_PLAN_ID || prefs.anchor !== "from-today") return false;
  const pace = prefs.ntDeepRepeatPace;
  return pace == null || pace === NT_DEEP_REPEAT_DEFAULT_PACE;
}

/**
 * 从未保存过计划选择时：本机显示轻松循环读经（复活节历元）。
 * 不带 chosen、不推云端——重装后不会冒充「用户已选」盖掉云端计划。
 */
export async function ensureDefaultReadingPlanIfUnset(): Promise<void> {
  const stored = await readReadingPlanPrefs();
  if (stored !== null && !isUnchosenNtDeepRepeatBootstrap(stored)) return;
  await writeReadingPlanPrefs(buildDefaultReadingPlanPrefs(), { notifySync: false });
}
