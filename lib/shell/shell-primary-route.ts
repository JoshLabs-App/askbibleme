import { isNatureHomeShellPath } from "@/components/home/HomeDockChromeContext";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * 应用壳一级页：显示左上用户菜单（`AppShellTopBar`）。
 * 读经章、计划详情等子路由不显示。
 */
export function isShellPrimaryAppRoute(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (isNatureHomeShellPath(p)) return true;
  if (p === "/music") return true;
  if (p === "/explore") return true;
  if (p === "/read") return true;
  if (p === "/scenes") return true;
  return false;
}
