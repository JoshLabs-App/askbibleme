/** 读经 Stack 子路由：底栏快捷操作行（与章页 `ReadChapterActionChrome` 同排） */

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** `/read/...` 章页（由 `ReadChapterScreen` 注册 catalog / 下一章） */
export function isReadChapterRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return /(^|\/)read\/[^/]+\/\d+$/.test(p);
}

/** 读经 Tab 圣经首页（目录） */
export function isReadBibleHomeRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  return /(^|\/)read$/.test(p) || /(^|\/)read\/index$/.test(p);
}

/** 从圣经目录 push 出的子页：搜索、收藏、计划等（不含目录首页与章页） */
export function isReadBibleStackSubRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (!/(^|\/)read\//.test(p)) return false;
  if (isReadChapterRoute(pathname)) return false;
  if (isReadBibleHomeRoute(pathname)) return false;
  return true;
}

/** 圣经首页、子页或章页：底栏需为快捷操作行留出滚动空间 */
export function readRouteUsesBottomActionChrome(pathname: string): boolean {
  return (
    isReadBibleHomeRoute(pathname) ||
    isReadChapterRoute(pathname) ||
    isReadBibleStackSubRoute(pathname)
  );
}
