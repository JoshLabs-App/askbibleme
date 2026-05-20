import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { useSyncExternalStore } from "react";
import {
  getHomeLandscapeImmersive,
  subscribeHomeLandscapeImmersive,
} from "../home/homeLandscapeImmersive";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/site-copy";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { ReadChapterActionChrome } from "../read/ReadChapterActionChrome";
import { useReadBottomChrome } from "../read/useReadBottomChrome";
import { ReadScriptureAudioDockStrip } from "../read/ReadScriptureAudioDockStrip";
import { trackTelemetry } from "../telemetry/client";
import { SHELL_ICON_ACTIVE, SHELL_ICON_MUTED } from "./shellChromeIcons";
import { ShellMaterialIcon } from "./ShellMaterialIcon";

type TabKey = "index" | "music" | "read" | "explore";

function tabTelemetryName(routeName: string): "home" | "music" | "read" | "explore" | null {
  switch (routeName as TabKey) {
    case "index":
      return "home";
    case "music":
      return "music";
    case "read":
      return "read";
    case "explore":
      return "explore";
    default:
      return null;
  }
}

function tabLabel(routeName: string): string {
  switch (routeName as TabKey) {
    case "index":
      return t("nav.home");
    case "music":
      return t("nav.music");
    case "read":
      return t("nav.read");
    case "explore":
      return t("nav.explore");
    default:
      return routeName;
  }
}

function tabIcon(routeName: string, active: boolean) {
  const size = 24;
  const color = active ? SHELL_ICON_ACTIVE : SHELL_ICON_MUTED;
  switch (routeName as TabKey) {
    case "index":
      return <ShellMaterialIcon name="home" size={size} color={color} />;
    case "music":
      return <ShellMaterialIcon name="library-music" size={size} color={color} />;
    case "read":
      return <ShellMaterialIcon name="menu-book" size={size} color={color} />;
    case "explore":
      return <ShellMaterialIcon name="explore" size={size} color={color} />;
    default:
      return <ShellMaterialIcon name="circle" size={size} color={color} />;
  }
}

/** 与网站 `HomeShellFloatingRouteNav` 同构：半透明图标，选中项略亮 + 下划线 */
export function ShellTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const playback = useMusicPlaybackOptional();
  const {
    playing = false,
    togglePlay = async () => {},
    canTogglePlayback = false,
    readChapterAudioAvailable = false,
    playbackMode = "music",
    scripturePreparing = false,
  } = playback ?? {};
  const canPlay = canTogglePlayback;
  const useScriptureLabels = readChapterAudioAvailable;
  const scripturePlaybackUi =
    readChapterAudioAvailable && playbackMode === "scripture";
  const showPauseIcon = scripturePlaybackUi
    ? playing || scripturePreparing
    : playing;
  const readBottomChrome = useReadBottomChrome();
  const homeLandscapeImmersive = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeLandscapeImmersive,
    getHomeLandscapeImmersive,
  );
  const onHomeTab = state.routes[state.index]?.name === "index";
  const hideForHomeLandscape = onHomeTab && homeLandscapeImmersive;

  const leftRoutes = state.routes.filter((r) => r.name === "index" || r.name === "music");
  const rightRoutes = state.routes.filter((r) => r.name === "read" || r.name === "explore");

  const renderTab = (routeName: string, routeKey: string, isFocused: boolean) => (
    <Pressable
      key={routeKey}
      onPress={() => {
        const tab = tabTelemetryName(routeName);
        if (tab) trackTelemetry("tab_select", { tab });
        navigation.navigate(routeName);
      }}
      style={styles.tabBtn}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tabLabel(routeName)}
    >
      {tabIcon(routeName, isFocused)}
      {isFocused ? <View style={styles.tabUnderline} /> : null}
    </Pressable>
  );

  if (hideForHomeLandscape) return null;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
    >
      {playback ? <ReadScriptureAudioDockStrip /> : null}
      {readBottomChrome ? (
        <ReadChapterActionChrome
          onOpenCatalog={readBottomChrome.openCatalog}
          onNextChapter={readBottomChrome.goNext}
          hasNextChapter={readBottomChrome.hasNext}
        />
      ) : null}
      <View style={styles.bar}>
        <View style={styles.side}>
          {leftRoutes.map((route) => {
            const i = state.routes.findIndex((r) => r.key === route.key);
            return renderTab(route.name, route.key, state.index === i);
          })}
        </View>

        <Pressable
          onPress={() => void togglePlay()}
          disabled={!canPlay}
          style={[styles.playFab, !canPlay && styles.playFabDisabled]}
          accessibilityRole="button"
          accessibilityLabel={
            !canPlay
              ? t("playback.noTrack")
              : showPauseIcon
                ? useScriptureLabels
                  ? t("playback.pauseLabel")
                  : t("playback.pauseMusic")
                : useScriptureLabels
                  ? t("playback.playLabel")
                  : t("playback.playMusic")
          }
        >
          <ShellMaterialIcon
            name={showPauseIcon ? "pause" : "play-arrow"}
            size={28}
            color={SHELL_ICON_ACTIVE}
          />
        </Pressable>

        <View style={styles.side}>
          {rightRoutes.map((route) => {
            const i = state.routes.findIndex((r) => r.key === route.key);
            return renderTab(route.name, route.key, state.index === i);
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    maxWidth: 400,
  },
  side: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tabBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 7,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: SHELL_ICON_ACTIVE,
  },
  playFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  playFabDisabled: { opacity: 0.4 },
});
