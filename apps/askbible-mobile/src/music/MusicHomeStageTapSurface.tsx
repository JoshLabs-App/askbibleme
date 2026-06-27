import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { musicCopy } from "./musicCopy";
import { useMusicPlayback } from "./MusicPlaybackContext";

type Props = {
  compactLandscape: boolean;
  children: ReactNode;
};

/** 音乐页视觉大区域：点一下暂停，再点一下播放（不含下方曲目列表）。 */
export function MusicHomeStageTapSurface({ compactLandscape, children }: Props) {
  const { playing, togglePlayMusic, canTogglePlayback, tracks } = useMusicPlayback();

  if (tracks.length === 0) return children;

  return (
    <Pressable
      style={[styles.surface, compactLandscape && styles.surfaceLandscape]}
      onPress={() => void togglePlayMusic()}
      disabled={!canTogglePlayback}
      accessibilityRole="button"
      accessibilityLabel={playing ? musicCopy.pause : musicCopy.play}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    width: "100%",
    minHeight: 80,
  },
  surfaceLandscape: {
    ...StyleSheet.absoluteFillObject,
    right: "42%",
    zIndex: 2,
  },
});
