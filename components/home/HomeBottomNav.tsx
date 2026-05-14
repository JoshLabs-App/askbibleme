"use client";

import { usePathname } from "next/navigation";
import { isNatureHomeShellPath } from "@/components/home/HomeDockChromeContext";
import { HomeShellFloatingRouteNav } from "@/components/home/HomeShellFloatingRouteNav";

/**
 * 非自然首页：壳层 fixed 图标导航。自然首页 `/`、`/nature` 由 `NatureVideoExperience` 内叠在视频上。
 */
export function HomeBottomNav() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin")) return null;
  if (isNatureHomeShellPath(pathname)) return null;
  return <HomeShellFloatingRouteNav placement="fixedShell" />;
}
