import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveUiText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { musicCopy } from "./musicCopy";

type Props = {
  locale: AppLocale;
  album: string;
  compactLandscape: boolean;
  chromeVisible: boolean;
  loading: boolean;
  hasCurrent: boolean;
  playing: boolean;
  canTogglePlayback: boolean;
  nowClockText: string;
  landscapeSafeHorizontal: { left: number; right: number } | null;
  bottomInset: number;
  onLandscapeStageToggle: () => void;
  onTogglePlay: () => void;
};

export function MusicHomeLandscapeChrome({
  locale,
  album,
  compactLandscape,
  chromeVisible,
  loading,
  hasCurrent,
  nowClockText,
  landscapeSafeHorizontal,
  bottomInset,
  onLandscapeStageToggle,
  onTogglePlay,
  playing,
  canTogglePlayback,
}: Props) {
  if (!compactLandscape) return null;

  return (
    <>
      {!chromeVisible && !loading && hasCurrent ? (
        <View
          pointerEvents="none"
          style={[styles.landscapeTimeOverlay, landscapeSafeHorizontal, { paddingBottom: bottomInset + 10 }]}
        >
          <Text style={[styles.landscapeTimeText, album === "睡眠" && styles.landscapeTimeTextSleep]}>
            {nowClockText}
          </Text>
        </View>
      ) : null}
      {!chromeVisible ? (
        <Pressable
          style={[styles.landscapeTapLayer, { right: "42%" }]}
          onPress={onLandscapeStageToggle}
          accessibilityRole="button"
          accessibilityLabel={resolveUiText(locale, "切换横屏音乐菜单", "Show landscape music menu")}
        />
      ) : null}
      {chromeVisible ? (
        <Pressable
          style={[styles.landscapeStageTapLayer, { right: "42%" }]}
          onPress={onTogglePlay}
          disabled={!canTogglePlayback}
          accessibilityRole="button"
          accessibilityLabel={playing ? musicCopy.pause : musicCopy.play}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  landscapeTapLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 8,
  },
  landscapeStageTapLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 8,
  },
  landscapeTimeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: "center",
  },
  landscapeTimeText: {
    fontSize: 56,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.92)",
    backgroundColor: "transparent",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  landscapeTimeTextSleep: {
    opacity: 0.5,
    color: "rgba(18,141,210,0.95)",
    textShadowColor: "rgba(4,34,62,0.5)",
  },
});
