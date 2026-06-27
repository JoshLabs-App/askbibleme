function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** 探索 Tab 首页 */
export function isExploreHomeRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return /(^|\/)explore$/.test(p) || /(^|\/)explore\/index$/.test(p);
}

/** 探索 · 读经规划器（全屏流程页） */
export function isExploreReadingPlannerRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    /\/explore\/reading-planner(\/|$)/.test(p) ||
    /^\/?\(tabs\)\/explore\/reading-planner(\/|$)/.test(p)
  );
}

export const EXPLORE_READING_PLANNER_STACK_ROUTE = "reading-planner/index";

export function isExploreReadingPlannerStackRoute(routeName: string | null | undefined): boolean {
  return routeName === EXPLORE_READING_PLANNER_STACK_ROUTE;
}

type ExploreTabStackState = {
  routes?: { name?: string }[];
  index?: number;
};

/** 探索 Tab 内 Stack 当前顶栏路由名（切 Tab 时 pathname 仍可能是其它 Tab）。 */
export function readExploreStackTopRouteName(
  exploreTabState: ExploreTabStackState | undefined,
): string | null {
  const routes = exploreTabState?.routes;
  if (!routes?.length) return null;
  const index = exploreTabState?.index ?? routes.length - 1;
  return routes[index]?.name ?? null;
}
