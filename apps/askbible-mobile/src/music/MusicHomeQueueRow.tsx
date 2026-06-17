import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { musicCopy } from "./musicCopy";
import { musicHomeQueuePanelStyles as styles } from "./musicHomeQueuePanelStyles";
import { musicHomeQueueRowOpacity, musicHomeQueueRowScale } from "./musicHomeQueueScroll";
import type { PlaybackTrack } from "./types";

type Props = {
  track: PlaybackTrack;
  displayIdx: number;
  active: boolean;
  queueScrollY: number;
  isDownloading: boolean;
  needsCache: boolean;
  onSelect: () => void;
};

export function MusicHomeQueueRow({
  track,
  displayIdx,
  active,
  queueScrollY,
  isDownloading,
  needsCache,
  onSelect,
}: Props) {
  const label = track.title.trim() || musicCopy.untitled;

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.queueRow,
        {
          opacity: musicHomeQueueRowOpacity(displayIdx, queueScrollY, active),
          transform: [{ scale: musicHomeQueueRowScale(displayIdx, queueScrollY, active) }],
        },
        pressed && styles.pressed,
      ]}
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
  );
}
