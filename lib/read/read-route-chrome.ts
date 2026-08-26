function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** 读经 Tab 圣经首页（`/read`），不含章页与子页。 */
export function isReadBibleHomeRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/read" || p === "/read/index";
}

/** `/read/...` 章页 */
export function isReadChapterRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return /^\/read\/[^/]+\/\d+$/.test(p);
}

/** 章页「目录」跳转的独立目录页（非圣经主页） */
export function isReadStandaloneCatalogRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/read/catalog" || p === "/read/read";
}
