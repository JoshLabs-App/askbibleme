import { useMusicPlaybackCatalogLifecycle } from "./useMusicPlaybackCatalogLifecycle";
import { useMusicPlaybackProviderState } from "./useMusicPlaybackProviderState";
import { useMusicPlaybackRefSync } from "./useMusicPlaybackRefSync";
import { useMusicPlaybackRefs } from "./useMusicPlaybackRefs";
import { useMusicPlaybackTracks, useMusicStoreRefSync } from "./useMusicPlaybackTracks";
import { useMusicResumePersistence } from "./useMusicResumePersistence";
import { useMusicSessionTelemetry } from "./useMusicSessionTelemetry";
import { useMusicShellControls } from "./useMusicShellControls";
import { useScripturePlaybackPrefs } from "./useScripturePlaybackPrefs";

export function useMusicPlaybackProviderSetup() {
  const refs = useMusicPlaybackRefs();
  const state = useMusicPlaybackProviderState();
  const {
    store,
    setStore,
    trackIndex,
    setTrackIndex,
    playing,
    setPlaying,
    loading,
    setLoading,
    playbackMode,
    readChapter,
    setReadChapter,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    setScripturePreparing,
    setMusicCurrentSec,
    setMusicDurationSec,
    musicRepeatMode,
    setMusicRepeatModeState,
    sleepTimerMinutes,
    setSleepTimerMinutesState,
    setMusicCatalogUpdateAvailable,
    downloadingTrackId,
    setDownloadingTrackId,
  } = state;

  const { tracks, setMusicPackRevision } = useMusicPlaybackTracks(store);
  useMusicStoreRefSync(refs.storeRef, store);

  const syncPlayingState = useMusicPlaybackRefSync(
    refs,
    { trackIndex, playbackMode, musicRepeatMode, playing },
    setPlaying,
  );

  const endMusicSession = useMusicSessionTelemetry(refs.musicSessionRef);
  const persistMusicResume = useMusicResumePersistence({
    tracks,
    storeRef: refs.storeRef,
    resumeTrackIdRef: refs.resumeTrackIdRef,
    resumePositionSecRef: refs.resumePositionSecRef,
  });

  const scripturePrefs = useScripturePlaybackPrefs({
    soundRef: refs.soundRef,
    playbackModeRef: refs.playbackModeRef,
  });

  const shellControls = useMusicShellControls({
    soundRef: refs.soundRef,
    playbackModeRef: refs.playbackModeRef,
    musicGainRef: refs.musicGainRef,
    musicRepeatModeRef: refs.musicRepeatModeRef,
    lastMusicProgressSecRef: refs.lastMusicProgressSecRef,
    lastScriptureProgressSecRef: refs.lastScriptureProgressSecRef,
    sleepTimerDeadlineRef: refs.sleepTimerDeadlineRef,
    musicRepeatMode,
    sleepTimerMinutes,
    setPlaying,
    setMusicCurrentSec,
    setScriptureCurrentSec,
    setMusicRepeatModeState,
    setSleepTimerMinutesState,
  });

  const catalog = useMusicPlaybackCatalogLifecycle({
    refs,
    tracks,
    trackIndex,
    setStore,
    setTrackIndex,
    setLoading,
    setMusicCurrentSec,
    setMusicDurationSec,
    setMusicCatalogUpdateAvailable,
  });

  return {
    refs,
    state,
    tracks,
    setMusicPackRevision,
    syncPlayingState,
    endMusicSession,
    persistMusicResume,
    scripturePrefs,
    shellControls,
    catalog,
    readChapter,
    setReadChapter,
    setPlaying,
    setPlaybackMode: state.setPlaybackMode,
    setScripturePreparing,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    setTrackIndex,
    setMusicCurrentSec,
    setMusicDurationSec,
    setDownloadingTrackId,
  };
}
