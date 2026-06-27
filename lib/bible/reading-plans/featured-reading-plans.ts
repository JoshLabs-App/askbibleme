import { isNtDeepRepeatPlanId, NT_DEEP_REPEAT_PLAN_ID } from "./nt-deep-repeat-plan";
import { isTripleLoopPlanId, TRIPLE_LOOP_PLAN_ID } from "./triple-loop-plan";
import type { ReadingPlanRegistryEntry } from "./types";

/** 读经计划目录：AskBible 主推（新约深读、三轨循环）。 */
export function isFeaturedReadingPlanId(planId: string): boolean {
  return isTripleLoopPlanId(planId) || isNtDeepRepeatPlanId(planId);
}

/** 目录页排序：深读 7 天优先，其次三循环。 */
export const FEATURED_READING_PLAN_ORDER = [NT_DEEP_REPEAT_PLAN_ID, TRIPLE_LOOP_PLAN_ID] as const;

export function compareReadingPlanCatalogOrder(
  a: Pick<ReadingPlanRegistryEntry, "planId">,
  b: Pick<ReadingPlanRegistryEntry, "planId">,
): number {
  const ai = FEATURED_READING_PLAN_ORDER.indexOf(a.planId as (typeof FEATURED_READING_PLAN_ORDER)[number]);
  const bi = FEATURED_READING_PLAN_ORDER.indexOf(b.planId as (typeof FEATURED_READING_PLAN_ORDER)[number]);
  if (ai >= 0 || bi >= 0) {
    if (ai < 0) return 1;
    if (bi < 0) return -1;
    return ai - bi;
  }
  return 0;
}

export function partitionReadingPlanCatalog(plans: ReadingPlanRegistryEntry[]): {
  featured: ReadingPlanRegistryEntry[];
  other: ReadingPlanRegistryEntry[];
} {
  const sorted = [...plans].sort(compareReadingPlanCatalogOrder);
  const featured = sorted.filter((p) => isFeaturedReadingPlanId(p.planId));
  const other = sorted.filter((p) => !isFeaturedReadingPlanId(p.planId));
  return { featured, other };
}
