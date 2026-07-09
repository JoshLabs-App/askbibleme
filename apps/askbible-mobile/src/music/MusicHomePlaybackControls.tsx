import { Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { AppLocale } from "../i18n/config";
import { MinimalProgressBar } from "../ui/MinimalProgressBar";
import { MusicHomeTransportButtonRow } from "./MusicHomeTransportButtonRow";
import { stepFilteredTrackIndex } from "./musicHomeFilteredTrackStep";
import { musicHomePlaybackControlsStyles as styles } from "./musicHomePlaybackControlsStyles";
import { musicCopy } from "./musicCopy";
import { formatPlaybackClock } from "./musicPlaybackProgress";
import type { MusicRepeatMode } from "./musicPlaybackTypes";

type Props = {
  locale: AppLocale;
  compactLandscape: boolean;
  playing: boolean;
  canTogglePlayback: boolean;
  onTogglePlay: () => void;
  selectedTrackTitle: string;
  position: number;
  duration: number;
  progress: number;
  musicRepeatMode: MusicRepeatMode;
  sleepTimerMinutes: number;
  sleepTimerBadge: string | null;
  filteredTrackIndices: number[];
  currentFilteredIndex: number;
  onSeekStart: () => void;
  onSeekPreview: (ratio: number) => void;
  onSeekRatio: (ratio: number) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onToggleRepeatOne: () => void;
  onToggleRepeatAll: () => void;
  onCycleSleepTimer: () => void;
  onPlayTrackAt: (index: number) => void;
};

export function MusicHomePlaybackControls({
  locale,
  compactLandscape,
  playing,
  canTogglePlayback,
  onTogglePlay,
  selectedTrackTitle,
  position,
  duration,
  progress,
  musicRepeatMode,
  sleepTimerMinutes,
  sleepTimerBadge,
  filteredTrackIndices,
  currentFilteredIndex,
  onSeekStart,
  onSeekPreview,
  onSeekRatio,
  onPrevTrack,
  onNextTrack,
  onToggleRepeatOne,
  onToggleRepeatAll,
  onCycleSleepTimer,
  onPlayTrackAt,
}: Props) {
  const goPrev = () => {
    const step = stepFilteredTrackIndex(filteredTrackIndices, currentFilteredIndex, "prev");
    if (step == null) {
      onPrevTrack();
      return;
    }
    onPlayTrackAt(filteredTrackIndices[step]!);
  };

  const goNext = () => {
    const step = stepFilteredTrackIndex(filteredTrackIndices, currentFilteredIndex, "next");
    if (step == null) {
      onNextTrack();
      return;
    }
    onPlayTrackAt(filteredTrackIndices[step]!);
  };

  return (
    <View style={styles.transport}>
      <Text style={styles.selectedTrackLine} numberOfLines={1}>
        {musicCopy.selectedTrack}: <Text style={styles.selectedTrackTitle}>{selectedTrackTitle}</Text>
      </Text>
      <Text style={styles.timeLine}>
        {formatPlaybackClock(position)}
        <Text style={styles.timeSep}> / </Text>
        {formatPlaybackClock(duration)}
      </Text>
      <MinimalProgressBar
        progress={progress}
        disabled={!duration}
        accessibilityLabel={musicCopy.progress}
        onSeekStart={onSeekStart}
        onSeekPreview={onSeekPreview}
        onSeekRatio={onSeekRatio}
      />
      <Pressable
        onPress={onTogglePlay}
        hitSlop={12}
        style={({ pressed }) => [
          styles.playBtn,
          playing && styles.playBtnOn,
          !canTogglePlayback && styles.playBtnDisabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={playing ? musicCopy.pause : musicCopy.play}
        accessibilityState={{ disabled: !canTogglePlayback, selected: playing }}
        disabled={!canTogglePlayback}
      >
        <MaterialIcons
          name={playing ? "pause" : "play-arrow"}
          size={28}
          color={playing ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.78)"}
        />
      </Pressable>
      <MusicHomeTransportButtonRow
        locale={locale}
        compactLandscape={compactLandscape}
        musicRepeatMode={musicRepeatMode}
        sleepTimerMinutes={sleepTimerMinutes}
        sleepTimerBadge={sleepTimerBadge}
        onPrev={goPrev}
        onNext={goNext}
        onToggleRepeatOne={onToggleRepeatOne}
        onToggleRepeatAll={onToggleRepeatAll}
        onCycleSleepTimer={onCycleSleepTimer}
      />
    </View>
  );
}
