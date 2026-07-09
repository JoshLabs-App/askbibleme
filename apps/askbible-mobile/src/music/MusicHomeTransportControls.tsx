import { View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { MusicHomeAlbumPicker } from "./MusicHomeAlbumPicker";
import { MusicHomePlaybackControls } from "./MusicHomePlaybackControls";
import type { MusicRepeatMode } from "./musicPlaybackTypes";

type Props = {
  locale: AppLocale;
  album: string;
  albumNames: string[];
  albumCounts: Record<string, number>;
  compactLandscape: boolean;
  chromeVisible: boolean;
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
  onSelectAlbum: (album: string) => void;
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

export function MusicHomeTransportControls(props: Props) {
  const { chromeVisible, locale, album, albumNames, albumCounts, onSelectAlbum, ...playbackProps } = props;

  return (
    <View style={!chromeVisible ? styles.chromeHidden : undefined} pointerEvents={chromeVisible ? "auto" : "none"}>
      <MusicHomeAlbumPicker
        locale={locale}
        album={album}
        albumNames={albumNames}
        albumCounts={albumCounts}
        onSelectAlbum={onSelectAlbum}
      />
      <MusicHomePlaybackControls locale={locale} {...playbackProps} />
    </View>
  );
}

import { musicHomeTransportControlsStyles as styles } from "./musicHomeTransportControlsStyles";
