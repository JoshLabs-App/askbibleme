function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** 探索 Tab 首页 */
export function isExploreHomeRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/explore" || p === "/explore/index";
}
