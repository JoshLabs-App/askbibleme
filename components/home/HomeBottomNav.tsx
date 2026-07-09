"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useAppImmersive } from "@/components/app-shell/AppImmersiveProvider";
import { isNatureHomeShellPath } from "@/components/home/HomeDockChromeContext";
import { HomeShellFloatingRouteNav } from "@/components/home/HomeShellFloatingRouteNav";
import {
  getMusicAutoHideChrome,
  isMusicShellPath,
  subscribeMusicAutoHideChrome,
} from "@/lib/music/music-auto-hide-chrome";

/**
 * 非自然首页：壳层 fixed 图标导航。自然首页 `/`、`/nature` 由 `NatureVideoExperience` 内叠在视频上。
 */
export function HomeBottomNav() {
  const pathname = usePathname() ?? "";
  const { immersive } = useAppImmersive();
  const musicAutoHideChrome = useSyncExternalStore(
    subscribeMusicAutoHideChrome,
    getMusicAutoHideChrome,
    () => false,
  );
  if (immersive) return null;
  if (pathname.startsWith("/admin")) return null;
  if (isNatureHomeShellPath(pathname)) return null;
  if (isMusicShellPath(pathname) && musicAutoHideChrome) return null;
  return <HomeShellFloatingRouteNav placement="fixedShell" />;
}
