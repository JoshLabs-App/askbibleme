import type { AppLocale } from "../i18n/config";
import { MusicHomeQueuePanel } from "./MusicHomeQueuePanel";
import { MusicHomeTransportControls } from "./MusicHomeTransportControls";
import type { MusicHomeScreenController } from "./useMusicHomeScreenController";

type Playback = MusicHomeScreenController["playback"];
type AlbumState = MusicHomeScreenController["albumState"];
type Gestures = MusicHomeScreenController["gestures"];
type Queue = MusicHomeScreenController["queue"];
type Props = {
  locale: AppLocale;
  compactLandscape: boolean;
  chromeVisible: boolean;
  playback: Playback;
  albumState: AlbumState;
  gestures: Gestures;
  queue: Queue;
  duration: number;
  musicActive: boolean;
  playbackMode: string;
};

export function MusicHomeForegroundPanel({
  locale,
  compactLandscape,
  chromeVisible,
  playback,
  albumState,
  gestures,
  queue,
  duration,
  musicActive,
  playbackMode,
}: Props) {
  const {
    album,
    filteredTrackIndices,
    albumNames,
    albumCounts,
    selectAlbum,
    currentFilteredIndex,
    offlineMusicOnly,
  } = albumState;
  const {
    tracks,
    trackIndex,
    playing,
    canTogglePlayback,
    musicRepeatMode,
    downloadingTrackId,
    togglePlayMusic,
    toggleMusicRepeatOne,
    toggleMusicRepeatAll,
    playTrackAt,
    playNext,
    seekRatio,
  } = playback;

  return (
    <>
      <MusicHomeQueuePanel
        queueDisplayIndices={filteredTrackIndices}
        tracks={tracks}
        trackIndex={trackIndex}
        queueScrollV={queue.queueScrollV}
        downloadingTrackId={downloadingTrackId}
        offlineMusicOnly={offlineMusicOnly}
        compactLandscape={compactLandscape}
        chromeVisible={chromeVisible}
        queueScrollRef={queue.queueScrollRef}
        onQueueScroll={queue.onQueueScroll}
        onSelectTrack={(index) => void playTrackAt(index)}
      />
      <MusicHomeTransportControls
        locale={locale}
        playing={playing}
        canTogglePlayback={canTogglePlayback}
        onTogglePlay={() => void togglePlayMusic()}
        album={album}
        albumNames={albumNames}
        albumCounts={albumCounts}
        chromeVisible={chromeVisible}
        duration={duration}
        musicActive={musicActive}
        trackIndex={trackIndex}
        playbackMode={playbackMode}
        seekRatio={seekRatio}
        musicRepeatMode={musicRepeatMode}
        filteredTrackIndices={filteredTrackIndices}
        currentFilteredIndex={currentFilteredIndex}
        onSelectAlbum={selectAlbum}
        onPrevTrack={() => void gestures.onPrev()}
        onNextTrack={() => void playNext()}
        onToggleRepeatOne={toggleMusicRepeatOne}
        onToggleRepeatAll={toggleMusicRepeatAll}
        onPlayTrackAt={(index) => void playTrackAt(index)}
      />
    </>
  );
}
