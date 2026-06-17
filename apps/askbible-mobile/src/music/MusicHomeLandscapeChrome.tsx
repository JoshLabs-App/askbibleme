import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveUiText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";

type Props = {
  locale: AppLocale;
  album: string;
  compactLandscape: boolean;
  chromeVisible: boolean;
  loading: boolean;
  hasCurrent: boolean;
  nowClockText: string;
  landscapeSafeHorizontal: { left: number; right: number } | null;
  landscapeCenterTapPosition: { left: number; top: number } | null;
  bottomInset: number;
  onLandscapeStageToggle: () => void;
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
  landscapeCenterTapPosition,
  bottomInset,
  onLandscapeStageToggle,
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
          style={styles.landscapeTapLayer}
          onPress={onLandscapeStageToggle}
          accessibilityRole="button"
          accessibilityLabel={resolveUiText(locale, "切换横屏音乐菜单", "Show landscape music menu")}
        />
      ) : null}
      {chromeVisible ? (
        <Pressable
          style={[styles.landscapeCenterTapTarget, landscapeCenterTapPosition]}
          onPress={onLandscapeStageToggle}
          accessibilityRole="button"
          accessibilityLabel={resolveUiText(locale, "隐藏横屏音乐菜单", "Hide landscape music menu")}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  landscapeTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  landscapeCenterTapTarget: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
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
