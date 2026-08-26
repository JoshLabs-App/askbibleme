import { View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { MusicHomeAlbumPicker } from "./MusicHomeAlbumPicker";
import { MusicHomePlaybackControls } from "./MusicHomePlaybackControls";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import { musicHomeTransportControlsStyles as styles } from "./musicHomeTransportControlsStyles";

type Props = {
  locale: AppLocale;
  album: string;
  albumNames: string[];
  albumCounts: Record<string, number>;
  chromeVisible: boolean;
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
  onSelectAlbum: (album: string) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onToggleRepeatOne: () => void;
  onToggleRepeatAll: () => void;
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
