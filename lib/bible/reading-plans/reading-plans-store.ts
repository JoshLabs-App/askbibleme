import fs from "node:fs";
import path from "node:path";
import staticRegistry from "@/data/bible-reading-plans/registry.json";
import { readPublicAssetJson } from "@/lib/read-public-asset";

import { getNtDeepRepeatRegistryEntry, isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { getTripleLoopRegistryEntry, isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { ReadingPlanBundle, ReadingPlanRegistry } from "@/lib/bible/reading-plans/types";

const REL_REGISTRY = path.join("data", "bible-reading-plans", "registry.json");
const REL_BUILT_DIR = path.join("data", "bible-reading-plans", "built");

export function readingPlansRegistryPath(cwd: string): string {
  return path.join(cwd, REL_REGISTRY);
}

export function readingPlanBundlePath(cwd: string, planId: string): string {
  const safe = planId.replace(/[^a-z0-9_-]/gi, "");
  return path.join(cwd, REL_BUILT_DIR, `${safe}.json`);
}

function sortRegistryPlans(plans: ReadingPlanRegistry["plans"]): ReadingPlanRegistry["plans"] {
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

function parseRegistry(j: ReadingPlanRegistry): ReadingPlanRegistry | null {
  if (j?.schemaVersion !== 1 || !Array.isArray(j.plans)) return null;
  const withoutNative = j.plans.filter(
    (plan) => !isTripleLoopPlanId(plan.planId) && !isNtDeepRepeatPlanId(plan.planId),
  );
  const plans = sortRegistryPlans([
    getTripleLoopRegistryEntry(),
    getNtDeepRepeatRegistryEntry(),
    ...withoutNative,
  ]);
  return { ...j, plans };
}

export function readReadingPlanRegistrySync(cwd: string): ReadingPlanRegistry | null {
  if (cwd === process.cwd()) {
    return parseRegistry(staticRegistry as ReadingPlanRegistry);
  }
  const p = readingPlansRegistryPath(cwd);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return parseRegistry(JSON.parse(raw) as ReadingPlanRegistry);
  } catch {
    return null;
  }
}

export function readReadingPlanBundleSync(cwd: string, planId: string): ReadingPlanBundle | null {
  if (isTripleLoopPlanId(planId) || isNtDeepRepeatPlanId(planId)) return null;
  const p = readingPlanBundlePath(cwd, planId);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const j = JSON.parse(raw) as ReadingPlanBundle;
    if (j?.schemaVersion !== 1 || !Array.isArray(j.days)) return null;
    return j;
  } catch {
    return null;
  }
}

export async function readReadingPlanBundle(cwd: string, planId: string): Promise<ReadingPlanBundle | null> {
  if (isTripleLoopPlanId(planId) || isNtDeepRepeatPlanId(planId)) return null;
  const safe = planId.replace(/[^a-z0-9_-]/gi, "");
  const asset = await readPublicAssetJson<ReadingPlanBundle>(`/data/bible-reading-plans/${safe}.json`, cwd);
  if (asset?.schemaVersion === 1 && Array.isArray(asset.days)) return asset;
  return readReadingPlanBundleSync(cwd, planId);
}
