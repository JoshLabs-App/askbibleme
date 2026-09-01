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
import {
  isReadBibleHomeRoute,
  isReadChapterRoute,
  isReadStandaloneCatalogRoute,
  readReadStackTopRouteName,
} from "../read/read-route-chrome";
import { useReadBottomChrome } from "../read/useReadBottomChrome";
import { ReadParchmentFillLayer } from "../read/ReadParchmentSurface";
import { ReadScriptureAudioDockStrip } from "../read/ReadScriptureAudioDockStrip";
import { shouldShowReadScriptureAudioDock } from "../read/readScriptureDockVisibility";
import { shouldHideShellTabBarPathname } from "./shellTabBarPath";
import { tabIcon, tabLabel, tabTelemetryName } from "./shellTabBarHelpers";
import { ShellScripturePlayFab } from "./ShellScripturePlayFab";
import { shellTabBarStyles as styles } from "./shellTabBarStyles";
import { isReadChapterPathname, isReadPlanPlayPathname } from "./shellPrimaryRoute";
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
  const onPlanPlay = isReadPlanPlayPathname(pathname);
  const onReadTab = state.routes[state.index]?.name === "read";
  const scriptureDockActive = Boolean(
    playback &&
      onReadTab &&
      !onPlanPlay &&
      shouldShowReadScriptureAudioDock({
        readChapterAudioAvailable: playback.readChapterAudioAvailable,
        onChapterPage: isReadChapterPathname(pathname ?? ""),
        playbackMode: playback.playbackMode,
        playing: playback.playing,
        scripturePreparing: playback.scripturePreparing,
      }),
  );
  const leftRoutes = state.routes.filter((r) => r.name === "index" || r.name === "music");
  const rightRoutes = state.routes.filter((r) => r.name === "read" || r.name === "explore");

  const renderTab = (routeName: string, routeKey: string, isFocused: boolean) => {
    const selected = onPlanPlay ? false : isFocused;
    return (
    <Pressable
      key={routeKey}
      onPress={() => {
        const jumpToTab = () => {
          const pressEvent = navigation.emit({
            type: "tabPress",
            target: routeKey,
            canPreventDefault: true,
          });
          if (pressEvent.defaultPrevented) return;
          if ("jumpTo" in navigation && typeof navigation.jumpTo === "function") {
            navigation.jumpTo(routeName);
            return;
          }
          navigation.navigate(routeName);
        };

        if (routeName === "read") {
          const readTab = state.routes.find((r) => r.name === "read");
          const readTop = readReadStackTopRouteName(
            readTab?.state as { routes?: { name?: string }[]; index?: number } | undefined,
          );
          const catalogOnStack = readTop === "catalog" || isReadStandaloneCatalogRoute(pathname);

          // 从其它 Tab 切回：若停在独立目录页，回到圣经主页（该页不是主页）。
          // 只用 router.replace，勿再 jumpTo（双导航会闪/错栈）。
          if (!isFocused && catalogOnStack) {
            router.replace("/read");
            return;
          }

          if (isFocused) {
            // 主页再点圣经：不要误开 /read/catalog。
            if (isReadBibleHomeRoute(pathname)) return;
            // 章页再点：打开独立目录。
            if (isReadChapterRoute(pathname) && readBottomChrome?.openCatalog) {
              readBottomChrome.openCatalog();
              return;
            }
            // 目录 / 其它子页：回到主页。
            if (!isReadBibleHomeRoute(pathname)) {
              router.replace("/read");
            }
            return;
          }
        }
        if (routeName === "explore") {
          const exploreTab = state.routes.find((r) => r.name === "explore");
          const exploreTop = readExploreStackTopRouteName(
            exploreTab?.state as { routes?: { name?: string }[]; index?: number } | undefined,
          );
          const flowOnStack = isExploreReadingPlannerStackRoute(exploreTop);
          if (isFocused && !isExploreHomeRoute(pathname)) {
            returnToExploreIndex(router);
            return;
          }
          // navigate("/explore") 已切 Tab，勿再 jumpTo。
          if (!isFocused && flowOnStack) {
            returnToExploreIndex(router);
            return;
          }
        }
        jumpToTab();
      }}
      onLongPress={() => {
        navigation.emit({ type: "tabLongPress", target: routeKey });
      }}
      style={({ pressed }) => [styles.tabBtn, pressed && styles.tabBtnPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={tabLabel(routeName)}
      testID={tabTelemetryName(routeName) ? `shell-tab-${tabTelemetryName(routeName)}` : undefined}
    >
      {tabIcon(routeName, selected)}
    </Pressable>
  );
  };

  if (hideForHomeLandscape || hideForMusicScene || hideForReadingPlanner) return null;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
      {...(Platform.OS === "android"
        ? {
            elevation: 0,
            backgroundColor: "transparent",
            collapsable: false,
          }
        : {})}
      pointerEvents="box-none"
    >
      {scriptureDockActive ? (
        <View pointerEvents="none" style={styles.scriptureDockParchmentHost}>
          <ReadParchmentFillLayer pinBottom />
        </View>
      ) : null}
      {playback && onReadTab && !onPlanPlay ? <ReadScriptureAudioDockStrip /> : null}
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

        <ShellScripturePlayFab routeSelected={onPlanPlay} />

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
