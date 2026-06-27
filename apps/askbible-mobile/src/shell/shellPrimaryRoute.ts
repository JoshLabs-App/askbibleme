import { isReadBibleHomeRoute } from "../read/read-route-chrome";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/** 自然首页 Tab（`index`）：非音乐/读经/探索子页 */
export function isHomeNatureRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (p === "/" || p === "/index") return true;
  return /^\/?\(tabs\)\/?$/.test(p) || /^\/?\(tabs\)\/index\/?$/.test(p);
}

/**
 * Tab 一级根（首页 / 音乐 / 读经目录 / 探索首页）：显示左上用户菜单。
 * 章页、搜索、计划、数算年日、祷告主题等子页不显示。
 */
export function isShellPrimaryTabPathname(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (isHomeNatureRoute(pathname)) return true;
  if (/(^|\/)music$/.test(p)) return true;
  if (isReadBibleHomeRoute(pathname)) return true;
  if (/(^|\/)explore$/.test(p) || /(^|\/)explore\/index$/.test(p)) return true;
  return false;
}

/** 读经 Tab 目录首页：显示右上译本/排版设置 */
export function isReadCatalogPathname(pathname: string): boolean {
  const p = normalizePath(pathname);
  return isReadBibleHomeRoute(pathname) || /(^|\/)read\/catalog$/.test(p);
}

/** 读经章页（如 `/(tabs)/read/GEN/1`） */
export function isReadChapterPathname(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    /^\/?\(tabs\)\/read\/[A-Za-z0-9_]+\/\d+$/.test(p) || /^\/?read\/[A-Za-z0-9_]+\/\d+$/.test(p)
  );
}

/** 目录或章页：显示右上译本/排版设置 */
export function isReadTypographySettingsPathname(pathname: string): boolean {
  return isReadCatalogPathname(pathname) || isReadChapterPathname(pathname);
}
