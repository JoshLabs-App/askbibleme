import type { Router } from "expo-router";
import { normalizeAskbibleAppHref, parseReadPlanPath } from "../../../../lib/bible/parse-askbible-read-link";

export function pushExploreReadPlan(router: Pick<Router, "push">, href: string): boolean {
  const plan = parseReadPlanPath(normalizeAskbibleAppHref(href));
  if (!plan) return false;
  router.push({
    pathname: "/read/plans/[planId]",
    params: { planId: plan.planId },
  });
  return true;
}
