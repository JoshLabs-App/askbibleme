import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { musicCopy } from "./musicCopy";

type Props = {
  compactLandscape: boolean;
  playing: boolean;
  canTogglePlayback: boolean;
  hasTracks: boolean;
  onTogglePlay: () => void;
  children: ReactNode;
};

/** 音乐页视觉大区域：点一下暂停，再点一下播放（不含下方曲目列表）。 */
export function MusicHomeStageTapSurface({
  compactLandscape,
  playing,
  canTogglePlayback,
  hasTracks,
  onTogglePlay,
  children,
}: Props) {
  if (!hasTracks) {
    return <View style={[styles.surface, compactLandscape && styles.surfaceLandscape]}>{children}</View>;
  }

  return (
    <View
      style={[styles.surface, compactLandscape && styles.surfaceLandscape]}
      pointerEvents="box-none"
    >
      <Pressable
        style={styles.tapHit}
        onPress={onTogglePlay}
        disabled={!canTogglePlayback}
        accessibilityRole="button"
        accessibilityLabel={playing ? musicCopy.pause : musicCopy.play}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    width: "100%",
    minHeight: 80,
    overflow: "visible",
  },
  surfaceLandscape: {
    ...StyleSheet.absoluteFillObject,
    right: "42%",
    zIndex: 2,
  },
  tapHit: {
    flex: 1,
    width: "100%",
    overflow: "visible",
  },
});
