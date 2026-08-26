import { View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { MusicHomeScrubber } from "./MusicHomeScrubber";
import { MusicHomeTransportButtonRow } from "./MusicHomeTransportButtonRow";
import { stepFilteredTrackIndex } from "./musicHomeFilteredTrackStep";
import { musicHomePlaybackControlsStyles as styles } from "./musicHomePlaybackControlsStyles";
import type { MusicRepeatMode } from "./musicPlaybackTypes";

type Props = {
  locale: AppLocale;
  playing: boolean;
  canTogglePlayback: boolean;
  onTogglePlay: () => void;
  duration: number;
  musicActive: boolean;
  trackIndex: number;
  playbackMode: string;
  seekRatio: (ratio: number) => Promise<void>;
  musicRepeatMode: MusicRepeatMode;
  filteredTrackIndices: number[];
  currentFilteredIndex: number;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onToggleRepeatOne: () => void;
  onToggleRepeatAll: () => void;
  onPlayTrackAt: (index: number) => void;
};

export function MusicHomePlaybackControls({
  locale,
  playing,
  canTogglePlayback,
  onTogglePlay,
  duration,
  musicActive,
  trackIndex,
  playbackMode,
  seekRatio,
  musicRepeatMode,
  filteredTrackIndices,
  currentFilteredIndex,
  onPrevTrack,
  onNextTrack,
  onToggleRepeatOne,
  onToggleRepeatAll,
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
    <View style={styles.playerDock}>
      <MusicHomeScrubber
        duration={duration}
        musicActive={musicActive}
        trackIndex={trackIndex}
        playbackMode={playbackMode}
        seekRatio={seekRatio}
      />
      <MusicHomeTransportButtonRow
        locale={locale}
        playing={playing}
        canTogglePlayback={canTogglePlayback}
        musicRepeatMode={musicRepeatMode}
        onPrev={goPrev}
        onNext={goNext}
        onTogglePlay={onTogglePlay}
        onToggleRepeatOne={onToggleRepeatOne}
        onToggleRepeatAll={onToggleRepeatAll}
      />
    </View>
  );
}
