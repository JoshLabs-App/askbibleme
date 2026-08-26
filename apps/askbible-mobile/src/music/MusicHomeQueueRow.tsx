import { useMemo } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Animated, Pressable, Text } from "react-native";
import { musicCopy } from "./musicCopy";
import { musicHomeQueuePanelStyles as styles } from "./musicHomeQueuePanelStyles";
import {
  MUSIC_HOME_QUEUE_ACTIVE_OPACITY,
  MUSIC_HOME_QUEUE_ACTIVE_SCALE,
  musicHomeQueueRowOpacityInterp,
  musicHomeQueueRowScaleInterp,
} from "./musicHomeQueueScroll";
import type { PlaybackTrack } from "./types";

type Props = {
  track: PlaybackTrack;
  displayIdx: number;
  active: boolean;
  queueScrollV: Animated.Value;
  isDownloading: boolean;
  needsCache: boolean;
  onSelect: () => void;
};

export function MusicHomeQueueRow({
  track,
  displayIdx,
  active,
  queueScrollV,
  isDownloading,
  needsCache,
  onSelect,
}: Props) {
  const label = track.title.trim() || musicCopy.untitled;

  // 当前曲目恒定高亮，其余按滚动位置淡入淡出；两者都只在行位置变化时算一次。
  const motion = useMemo(() => {
    if (active) {
      return { opacity: MUSIC_HOME_QUEUE_ACTIVE_OPACITY, scale: MUSIC_HOME_QUEUE_ACTIVE_SCALE };
    }
    return {
      opacity: queueScrollV.interpolate({
        ...musicHomeQueueRowOpacityInterp(displayIdx),
        extrapolate: "clamp",
      }),
      scale: queueScrollV.interpolate({
        ...musicHomeQueueRowScaleInterp(displayIdx),
        extrapolate: "clamp",
      }),
    };
  }, [active, displayIdx, queueScrollV]);

  return (
    <Animated.View style={{ opacity: motion.opacity, transform: [{ scale: motion.scale }] }}>
      <Pressable
        onPress={onSelect}
        style={({ pressed }) => [styles.queueRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        {isDownloading ? (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.queueDownloadIcon} />
        ) : needsCache ? (
          <MaterialIcons
            name="cloud-download"
            size={16}
            color="rgba(255,255,255,0.55)"
            style={styles.queueDownloadIcon}
          />
        ) : null}
        <Text style={[styles.queueText, active && styles.queueTextActive]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
