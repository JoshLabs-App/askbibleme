import { useSyncExternalStore } from "react";
import { usePathname } from "expo-router";
import {
  getHomeAutoHideChrome,
  getHomeLandscapeImmersive,
  subscribeHomeLandscapeImmersive,
} from "../home/homeLandscapeImmersive";
import {
  getMusicAutoHideChrome,
  subscribeMusicAutoHideChrome,
} from "../music/musicAutoHideChrome";
import { subscribeTabBarPortal, getTabBarPortalProps } from "./shellTabBarPortalStore";
import { shouldHideShellTabBarPathname } from "./shellTabBarPath";

/** 与 `ShellTabBar` 相同的显隐条件，供底栏渐隐层同步 */
export function useShellTabBarVisible(): boolean {
  const pathname = usePathname();
  const tabProps = useSyncExternalStore(
    subscribeTabBarPortal,
    getTabBarPortalProps,
    getTabBarPortalProps,
  );
  const activeRoute = tabProps?.state.routes[tabProps.state.index]?.name;

  const homeLandscapeImmersive = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeLandscapeImmersive,
    getHomeLandscapeImmersive,
  );
  const homeAutoHideChrome = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeAutoHideChrome,
    getHomeAutoHideChrome,
  );
  const musicAutoHideChrome = useSyncExternalStore(
    subscribeMusicAutoHideChrome,
    getMusicAutoHideChrome,
    getMusicAutoHideChrome,
  );

  const onHomeTab = activeRoute === "index";
  const onMusicTab = activeRoute === "music";
  if (shouldHideShellTabBarPathname(pathname)) return false;
  if (onHomeTab && (homeLandscapeImmersive || homeAutoHideChrome)) return false;
  if (onMusicTab && musicAutoHideChrome) return false;
  return Boolean(tabProps);
}
