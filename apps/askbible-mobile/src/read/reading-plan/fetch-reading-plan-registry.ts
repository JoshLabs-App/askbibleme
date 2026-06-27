import { getBundledReadingPlanRegistry } from "./bundled-reading-plans";
import { getNtDeepRepeatRegistryEntry } from "./nt-deep-repeat-plan";
import { getTripleLoopRegistryEntry } from "./triple-loop-plan";
import type { ReadingPlanRegistry, ReadingPlanRegistryEntry } from "./types";

function mergeNativeReadingPlans(plans: ReadingPlanRegistryEntry[]): ReadingPlanRegistryEntry[] {
  const merged = [getTripleLoopRegistryEntry(), getNtDeepRepeatRegistryEntry(), ...plans];
  const byPlanId = new Map<string, ReadingPlanRegistryEntry>();
  for (const plan of merged) {
    if (!plan?.planId) continue;
    if (!byPlanId.has(plan.planId)) byPlanId.set(plan.planId, plan);
  }
  return Array.from(byPlanId.values());
}

function sortPlans(plans: ReadingPlanRegistryEntry[]): ReadingPlanRegistryEntry[] {
  return plans
    .filter((p) => !p.listHidden)
    .slice()
    .sort((a, b) => {
      const pa = typeof a.listPriority === "number" ? a.listPriority : 100;
      const pb = typeof b.listPriority === "number" ? b.listPriority : 100;
      if (pa !== pb) return pa - pb;
      return a.planId.localeCompare(b.planId);
    });
}

export function fallbackReadingPlanRegistry(): ReadingPlanRegistry {
  return {
    schemaVersion: 1,
    upstreamNote: "",
    plans: sortPlans(mergeNativeReadingPlans([])),
  };
}

/** 计划目录仅读 APK 内 JSON；进度与「第几天」在本机 AsyncStorage，每人不同。 */
export function getLocalReadingPlanRegistry(): ReadingPlanRegistry {
  const registry = getBundledReadingPlanRegistry();
  if (registry?.schemaVersion === 1 && Array.isArray(registry.plans) && registry.plans.length > 0) {
    return { ...registry, plans: sortPlans(mergeNativeReadingPlans(registry.plans)) };
  }
  return fallbackReadingPlanRegistry();
}

export async function fetchReadingPlanRegistry(): Promise<ReadingPlanRegistry> {
  return getLocalReadingPlanRegistry();
}
