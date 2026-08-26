import type { AppLocale } from "../../i18n/config";
import { createT, resolveUiText } from "../../i18n/site-copy";
import { isTripleLoopPlanId } from "./triple-loop-plan";

/** 未选或轻松循环：轻松读经。其它计划用目录名，与闹钟页一致。 */
export function resolveReadingPlanDisplayTitle(locale: AppLocale, planId: string | null | undefined): string {
  if (planId && !isTripleLoopPlanId(planId)) {
    const key = `pages.read.plansCatalog.${planId}.title`;
    const title = createT(locale)(key);
    if (title && title !== key) return title;
  }
  return resolveUiText(locale, "轻松读经", "Easy reading");
}
