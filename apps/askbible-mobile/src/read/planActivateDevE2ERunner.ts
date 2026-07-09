import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateNtDeepRepeatPlan } from "./reading-plan/nt-deep-repeat-plan-sync";
import { NT_DEEP_REPEAT_PLAN_ID } from "./reading-plan/nt-deep-repeat-plan";
import {
  localDaysBetween,
  readReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  setActiveReadingPlan,
  toLocalDateString,
  writeReadingPlanPrefs,
} from "./reading-plan/reading-plan-prefs";
import { resolveEffectiveEpochDay } from "./reading-plan/reading-plan-ahead";

const LOG = "[E2E-PlanActivate]";
export const RESULT_KEY = "askbible-e2e-plan-activate-result-v1";

async function writeResult(status: "pass" | "fail", detail: string): Promise<void> {
  const payload = JSON.stringify({ status, detail, at: new Date().toISOString() });
  console.log(`${LOG} ${status.toUpperCase()} ${detail}`);
  try {
    await AsyncStorage.setItem(RESULT_KEY, payload);
  } catch {
    /* ignore */
  }
}

/** __DEV__：验证「更新起始方式」可设置起始日且不回跳首页（由调用方 stay on page）。 */
export async function runPlanActivateDevE2E(): Promise<void> {
  if (!__DEV__) return;

  const today = toLocalDateString(new Date());
  const targetStartDay = 15;

  try {
    await writeReadingPlanPrefs(null);

    await activateNtDeepRepeatPlan({ dayCount: 365, startDay: targetStartDay });
    const ntPrefs = await readReadingPlanPrefs();
    if (!ntPrefs || ntPrefs.planId !== NT_DEEP_REPEAT_PLAN_ID) {
      await writeResult("fail", "nt-deep-repeat prefs missing after activate");
      return;
    }
    const ntCalendarDay = resolveReadingPlanDayIndex(ntPrefs, 365) + 1;
    const ntEffectiveDay = resolveEffectiveEpochDay(ntPrefs);
    if (ntCalendarDay !== targetStartDay) {
      await writeResult(
        "fail",
        `nt-deep-repeat calendar day ${ntCalendarDay} !== ${targetStartDay} (startedOn=${ntPrefs.startedOn})`,
      );
      return;
    }
    if (ntEffectiveDay < targetStartDay) {
      await writeResult("fail", `nt-deep-repeat effective day ${ntEffectiveDay} < ${targetStartDay}`);
      return;
    }

    await writeReadingPlanPrefs(null);
    const backDated = new Date();
    backDated.setDate(backDated.getDate() - (targetStartDay - 1));
    await setActiveReadingPlan("mcheyne", "from-today", { dayCount: 365, now: backDated });
    const otherPrefs = await readReadingPlanPrefs();
    if (!otherPrefs?.startedOn) {
      await writeResult("fail", "calendar plan startedOn missing");
      return;
    }
    const otherDay = localDaysBetween(otherPrefs.startedOn, today) + 1;
    if (otherDay !== targetStartDay) {
      await writeResult(
        "fail",
        `calendar plan day ${otherDay} !== ${targetStartDay} (startedOn=${otherPrefs.startedOn})`,
      );
      return;
    }

    await writeResult("pass", `startDay=${targetStartDay} nt=${ntCalendarDay} calendar=${otherDay}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeResult("fail", msg);
  }
}
