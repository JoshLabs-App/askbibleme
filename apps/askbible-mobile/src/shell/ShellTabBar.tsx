import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
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
import { t } from "../i18n/site-copy";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import {
  getMusicAutoHideChrome,
  subscribeMusicAutoHideChrome,
} from "../music/musicAutoHideChrome";
import { ReadChapterActionChrome } from "../read/ReadChapterActionChrome";
import { isReadBibleHomeRoute } from "../read/read-route-chrome";
import { useReadBottomChrome } from "../read/useReadBottomChrome";
import { ReadScriptureAudioDockStrip } from "../read/ReadScriptureAudioDockStrip";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "./splash-branding.generated";
import { trackTelemetry } from "../telemetry/client";
import { SHELL_TAB_BAR_ICON } from "./shellChromeIcons";
import { ShellMaterialIcon } from "./ShellMaterialIcon";
import { PLAY_ICON_SIZE, tabIcon, tabLabel, tabTelemetryName } from "./shellTabBarHelpers";
import { shellTabBarStyles as styles } from "./shellTabBarStyles";

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
  const {
    playing = false,
    togglePlayMusic = async () => {},
    togglePlayScripture = async () => {},
    playbackMode = "music",
    canTogglePlayback = false,
    readChapterAudioAvailable = false,
    scripturePreparing = false,
  } = playback ?? {};
  const readBottomChrome = useReadBottomChrome();
  const onReadTab = state.routes[state.index]?.name === "read";
  const readFabUsesScripture = onReadTab;
  const canPlayFab = readFabUsesScripture ? readChapterAudioAvailable : canTogglePlayback;
  const musicActive = playbackMode === "music" && playing;
  const scriptureActive = playbackMode === "scripture" && (playing || scripturePreparing);
  const fabActive = readFabUsesScripture ? scriptureActive : musicActive;
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
  const onHomeTab = state.routes[state.index]?.name === "index";
  const hideForHomeLandscape = onHomeTab && (homeLandscapeImmersive || homeAutoHideChrome);
  const musicAutoHideChrome = useSyncExternalStore(
    subscribeMusicAutoHideChrome,
    getMusicAutoHideChrome,
    getMusicAutoHideChrome,
  );
  const onMusicTab = state.routes[state.index]?.name === "music";
  const hideForMusicScene = onMusicTab && musicAutoHideChrome;
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

  if (hideForHomeLandscape || hideForMusicScene) return null;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
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

        <Pressable
          onPress={() =>
            void (readFabUsesScripture ? togglePlayScripture() : togglePlayMusic())
          }
          disabled={!canPlayFab}
          style={[styles.playFab, !canPlayFab && styles.playFabDisabled]}
          accessibilityRole="button"
          accessibilityLabel={
            !canPlayFab
              ? t("playback.noTrack")
              : readFabUsesScripture
                ? scriptureActive
                  ? t("pages.read.chapterChromeAudioPause")
                  : t("pages.read.chapterChromeAudio")
                : musicActive
                  ? t("playback.pauseMusic")
                  : t("playback.playMusic")
          }
        >
          <ShellMaterialIcon
            name={fabActive ? "pause" : "play-arrow"}
            size={PLAY_ICON_SIZE}
            color={fabActive ? LOGO_COLOR : SHELL_TAB_BAR_ICON}
          />
        </Pressable>

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
