import type { AppLocale } from "../i18n/config";
import { MusicHomeQueuePanel } from "./MusicHomeQueuePanel";
import { MusicHomeTransportControls } from "./MusicHomeTransportControls";
import type { MusicHomeScreenController } from "./useMusicHomeScreenController";

type Playback = MusicHomeScreenController["playback"];
type Seek = MusicHomeScreenController["seek"];
type SleepTimer = MusicHomeScreenController["sleepTimer"];
type AlbumState = MusicHomeScreenController["albumState"];
type Gestures = MusicHomeScreenController["gestures"];
type Queue = MusicHomeScreenController["queue"];
type Props = {
  locale: AppLocale;
  compactLandscape: boolean;
  chromeVisible: boolean;
  playback: Playback;
  seek: Seek;
  sleepTimer: SleepTimer;
  albumState: AlbumState;
  gestures: Gestures;
  queue: Queue;
  duration: number;
  position: number;
  progress: number;
};

export function MusicHomeForegroundPanel({
  locale,
  compactLandscape,
  chromeVisible,
  playback,
  seek,
  sleepTimer,
  albumState,
  gestures,
  queue,
  duration,
  position,
  progress,
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
    musicRepeatMode,
    sleepTimerMinutes,
    downloadingTrackId,
    toggleMusicRepeatOne,
    toggleMusicRepeatAll,
    playTrackAt,
    playNext,
    seekRatio,
  } = playback;

  return (
    <>
      <MusicHomeQueuePanel
        queueDisplayIndices={queue.queueDisplayIndices}
        tracks={tracks}
        trackIndex={trackIndex}
        queueScrollY={queue.queueScrollY}
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
        album={album}
        albumNames={albumNames}
        albumCounts={albumCounts}
        compactLandscape={compactLandscape}
        chromeVisible={chromeVisible}
        position={position}
        duration={duration}
        progress={progress}
        musicRepeatMode={musicRepeatMode}
        sleepTimerMinutes={sleepTimerMinutes}
        sleepTimerBadge={sleepTimer.sleepTimerBadge}
        filteredTrackIndices={filteredTrackIndices}
        currentFilteredIndex={currentFilteredIndex}
        onSelectAlbum={selectAlbum}
        onSeekStart={() => seek.setSeekDragging(true)}
        onSeekPreview={seek.setSeekPreview}
        onSeekRatio={(r) => {
          seek.setSeekPreview(r);
          void seekRatio(r).finally(() => seek.setSeekDragging(false));
        }}
        onPrevTrack={() => void gestures.onPrev()}
        onNextTrack={() => void playNext()}
        onToggleRepeatOne={toggleMusicRepeatOne}
        onToggleRepeatAll={toggleMusicRepeatAll}
        onCycleSleepTimer={sleepTimer.cycleSleepTimer}
        onPlayTrackAt={(index) => void playTrackAt(index)}
      />
    </>
  );
}
