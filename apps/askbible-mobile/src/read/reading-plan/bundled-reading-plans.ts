import type { ReadingPlanDayPayload } from "./fetch-reading-plan-day";
import {
  BUNDLED_READING_PLAN_REGISTRY,
  getBundledReadingPlanBundle,
} from "./generated/bundled-reading-plans";
import type { ReadingPlanRegistry } from "./types";

export function getBundledReadingPlanRegistry(): ReadingPlanRegistry {
  return BUNDLED_READING_PLAN_REGISTRY;
}

export function loadBundledReadingPlanDay(
  planId: string,
  dayIndex: number,
): ReadingPlanDayPayload | null {
  if (typeof planId !== "string" || !planId.trim()) return null;
  const bundle = getBundledReadingPlanBundle(planId);
  if (!bundle || !Array.isArray(bundle.days)) return null;
  const day = bundle.days[dayIndex] ?? null;
  return {
    planId: bundle.planId,
    name: bundle.name,
    dayCount: bundle.days.length,
    dayIndex,
    day,
  };
}
