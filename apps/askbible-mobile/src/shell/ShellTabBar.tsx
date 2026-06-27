import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePathname, useRouter } from "expo-router";
import { Platform, Pressable, View } from "react-native";
import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  getTabBarPortalProps,
  setTabBarPortalProps,
  subscribeTabBarPortal,
} from "./shellTabBarPortalStore";
import {
  getHomeAutoHideChrome,
  getHomeLandscapeImmersive,
  subscribeHomeLandscapeImmersive,
} from "../home/homeLandscapeImmersive";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import {
  getMusicAutoHideChrome,
  subscribeMusicAutoHideChrome,
} from "../music/musicAutoHideChrome";
import { ReadChapterActionChrome } from "../read/ReadChapterActionChrome";
import { isReadBibleHomeRoute } from "../read/read-route-chrome";
import { useReadBottomChrome } from "../read/useReadBottomChrome";
import { ReadScriptureAudioDockStrip } from "../read/ReadScriptureAudioDockStrip";
import { shouldHideShellTabBarPathname } from "./shellTabBarPath";
import { trackTelemetry } from "../telemetry/client";
import { tabIcon, tabLabel, tabTelemetryName } from "./shellTabBarHelpers";
import { ShellScripturePlayFab } from "./ShellScripturePlayFab";
import { shellTabBarStyles as styles } from "./shellTabBarStyles";
import {
  isExploreHomeRoute,
  isExploreReadingPlannerStackRoute,
  readExploreStackTopRouteName,
} from "../explore/explore-route-chrome";
import { returnToExploreIndex } from "../explore/explore-read-chapter-nav";

/** 挂在 Tabs `tabBar` 槽内同步状态，实际 UI 由 `ShellTabBarPortal` 浮在导航器外渲染 */
export function ShellTabBarCapture(props: BottomTabBarProps) {
  useLayoutEffect(() => {
    setTabBarPortalProps(props);
  });
  return null;
}

export function ShellTabBarPortal() {
  const props = useSyncExternalStore(
    subscribeTabBarPortal,
    getTabBarPortalProps,
    getTabBarPortalProps,
  );
  if (!props) return null;
  return <ShellTabBar {...props} />;
}

/** 与网站 `HomeShellFloatingRouteNav` 同构：无底栏胶囊、无图标底色/边框，选中项略亮 */
export function ShellTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const playback = useMusicPlaybackOptional();
  const readBottomChrome = useReadBottomChrome();
  const onHomeTab = state.routes[state.index]?.name === "index";
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
  const hideForHomeLandscape = onHomeTab && (homeLandscapeImmersive || homeAutoHideChrome);
  const musicAutoHideChrome = useSyncExternalStore(
    subscribeMusicAutoHideChrome,
    getMusicAutoHideChrome,
    getMusicAutoHideChrome,
  );
  const onMusicTab = state.routes[state.index]?.name === "music";
  const hideForMusicScene = onMusicTab && musicAutoHideChrome;
  const hideForReadingPlanner = shouldHideShellTabBarPathname(pathname);
  const leftRoutes = state.routes.filter((r) => r.name === "index" || r.name === "music");
  const rightRoutes = state.routes.filter((r) => r.name === "read" || r.name === "explore");

  const renderTab = (routeName: string, routeKey: string, isFocused: boolean) => (
    <Pressable
      key={routeKey}
      onPress={() => {
        if (routeName === "read" && isFocused) {
          if (readBottomChrome?.openCatalog) {
            readBottomChrome.openCatalog();
            return;
          }
          if (!isReadBibleHomeRoute(pathname)) {
            router.replace("/read");
          }
          return;
        }
        if (routeName === "explore") {
          const exploreTab = state.routes.find((r) => r.name === "explore");
          const exploreTop = readExploreStackTopRouteName(
            exploreTab?.state as { routes?: { name?: string }[]; index?: number } | undefined,
          );
          const plannerOnStack = isExploreReadingPlannerStackRoute(exploreTop);
          if (isFocused && !isExploreHomeRoute(pathname)) {
            returnToExploreIndex(router);
            return;
          }
          if (!isFocused && plannerOnStack) {
            returnToExploreIndex(router);
            return;
          }
        }
        const pressEvent = navigation.emit({
          type: "tabPress",
          target: routeKey,
          canPreventDefault: true,
        });
        if (pressEvent.defaultPrevented) return;
        const tab = tabTelemetryName(routeName);
        if (tab) trackTelemetry("tab_select", { tab });
        if ("jumpTo" in navigation && typeof navigation.jumpTo === "function") {
          navigation.jumpTo(routeName);
          return;
        }
        navigation.navigate(routeName);
      }}
      onLongPress={() => {
        navigation.emit({ type: "tabLongPress", target: routeKey });
      }}
      style={({ pressed }) => [styles.tabBtn, pressed && styles.tabBtnPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tabLabel(routeName)}
    >
      {tabIcon(routeName, isFocused)}
    </Pressable>
  );

  if (hideForHomeLandscape || hideForMusicScene || hideForReadingPlanner) return null;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
      {...(Platform.OS === "android"
        ? { elevation: 0, backgroundColor: "transparent", collapsable: false }
        : {})}
      pointerEvents="box-none"
    >
      {playback ? <ReadScriptureAudioDockStrip /> : null}
      {readBottomChrome ? (
        <ReadChapterActionChrome />
      ) : null}
      <View style={styles.row}>
        <View style={[styles.side, styles.sideLeft]}>
          {leftRoutes.map((route) => {
            const i = state.routes.findIndex((r) => r.key === route.key);
            return renderTab(route.name, route.key, state.index === i);
          })}
        </View>

        <ShellScripturePlayFab />

        <View style={[styles.side, styles.sideRight]}>
          {rightRoutes.map((route) => {
            const i = state.routes.findIndex((r) => r.key === route.key);
            return renderTab(route.name, route.key, state.index === i);
          })}
        </View>
      </View>
    </View>
  );
}
