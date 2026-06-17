function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** 首页 / 音乐：全屏视频或封面舞台，不需要底栏羊皮渐隐。 */
export function isShellVideoStageTabRoute(routeName: string | undefined): boolean {
  return routeName === "index" || routeName === "music";
}

/** 探索 Tab 曾用底栏 scrim；现与读经一致改由 scroll mask 渐隐。 */
export function isParchmentTabBarRoute(routeName: string | undefined): boolean {
  return routeName === "explore";
}

/**
 * 是否渲染底栏羊皮渐隐层。
 * 读经 / 探索关闭：正文由 `ReadParchmentScrollMask` 渐隐，羊皮底纹保持实色不叠 scrim。
 * 以 Tab `routeName` 为准（pathname 切 Tab 时可能仍指上一栈）；首页 / 音乐 Tab 强制关闭。
 */
export function shouldShowParchmentTabBarScrim(routeName: string | undefined): boolean {
  if (!routeName) return false;
  if (isShellVideoStageTabRoute(routeName)) return false;
  if (routeName === "read" || routeName === "explore") return false;
  return isParchmentTabBarRoute(routeName);
}

/** pathname 仅作诊断/备用，不参与显隐决策。 */
export function isParchmentTabBarPathname(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (/(^|\/)read(\/|$)/.test(p) || /^\/?\(tabs\)\/read(\/|$)/.test(p)) return true;
  if (/(^|\/)explore(\/|$)/.test(p) || /^\/?\(tabs\)\/explore(\/|$)/.test(p)) return true;
  return false;
}
