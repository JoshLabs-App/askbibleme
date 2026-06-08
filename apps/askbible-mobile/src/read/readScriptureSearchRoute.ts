/** 与探索文章路由相同：Android 上显式 pathname，避免栈内字符串 push 偶发异常 */
export function readScriptureSearchRoute() {
  return { pathname: "/read/search" as const };
}
