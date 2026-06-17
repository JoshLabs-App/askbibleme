import { Text, View } from "react-native";
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
