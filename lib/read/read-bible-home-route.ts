function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** 读经 Tab 圣经首页（`/read`），不含章页与子页。 */
export function isReadBibleHomePath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/read";
}
