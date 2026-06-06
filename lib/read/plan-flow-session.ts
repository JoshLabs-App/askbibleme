const PLAN_FLOW_ACTIVE_KEY = "askbible-plan-flow-active-v1";

export function readPlanFlowActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(PLAN_FLOW_ACTIVE_KEY) === "1") return true;
    return new URLSearchParams(window.location.search).get("planFlow") === "1";
  } catch {
    return false;
  }
}

export function setPlanFlowActive(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) sessionStorage.setItem(PLAN_FLOW_ACTIVE_KEY, "1");
    else sessionStorage.removeItem(PLAN_FLOW_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}
