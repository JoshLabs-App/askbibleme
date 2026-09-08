import { getPlaybackSnapshot } from "../audio/playbackState";
import { useCallback, useRef } from "react";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safePauseSound,
  safePlaySound,
} from "../audio/safeShellSound";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import { syncMusicResumeForManualPlay } from "./musicResumeForManualPlay";
import { isTrackPlayable, resolveShellMusicPlayIndex } from "./trackArtwork";
import type { PlaybackTrack } from "./types";
import { releaseScriptureShellForMusic } from "./scripturePlaybackPriority";
import {
  clearShellMediaSessionUserDismissed,
  pauseShellAppMusic,
  resumeShellAppMusic,
} from "../audio/shellMediaControls";
import { getShellAuxMediaOwner } from "../audio/shellAuxMediaOwner";
import {
  getShellMusicNativePlaying,
  setShellMusicNativePlaying,
} from "../audio/shellMusicNativePlaying";
import {
  getShellMusicWantPlaying,
  setShellMusicWantPlaying,
} from "../audio/shellMusicWantPlaying";
import { refreshShellMediaSession } from "../audio/shellMediaSessionPayload";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { yieldAmbientIfVerseAndAmbientOpen } from "../home/homeGoldenVerseTwoSourceMutex";
import { fadeSoundVolume, shouldUseCalmAlbumFade } from "./musicCalmPlayback";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import {
  canResumeExistingMusicSound,
  isMusicTogglePauseIntent,
} from "./musicTogglePlayMusicIntent";

type Args = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  trackIndex: number;
  /** UI 播放态：用于决定暂停/播放，避免 playingStateRef 与真实 isPlaying 脱节后永远走暂停分支 */
  playing: boolean;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  setPlaying: (playing: boolean) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  stopScripturePlayback: () => Promise<void>;
};

export function useMusicTogglePlayMusic({
  bridge,
  tracks,
  trackIndex,
  playing,
  playTrackAt,
  persistMusicResume,
  setPlaying,
  setPlaybackMode,
  setMusicCurrentSec,
  setMusicDurationSec,
  stopScripturePlayback,
}: Args) {
  const {
    soundRef,
    playbackModeRef,
    trackIndexRef,
    lastMusicProgressSecRef,
    musicGainRef,
    playingStateRef,
    resumeTrackIdRef,
    resumePositionSecRef,
  } = bridge;
  const toggleEpochRef = useRef(0);

  return useCallback(async () => {
    if (tracks.length === 0) return;
    const epoch = ++toggleEpochRef.current;
    const stillCurrent = () => epoch === toggleEpochRef.current;

    // 先按用户意图切 UI，再 await 音频；避免点了没反馈连点多次。
    // 含原生实播：JS 标志被清但 AVPlayer 仍在出声时，点图标应暂停而非再 play。
    // 读经与音乐共用 playing / soundRef：暂停只认音乐模式，避免首页音乐键去停章朗读。
    const leavingScripture =
      playbackModeRef.current === "scripture" || getShellScriptureWantPlaying();
    const musicUiPlaying = isMusicTogglePauseIntent({
      musicPlaying: getPlaybackSnapshot().music.playing,
    });

    if (musicUiPlaying) {
      setShellMusicWantPlaying(false);
      setShellMusicNativePlaying(false);
      playingStateRef.current = false;
      setPlaying(false);
      pauseShellAppMusic();
      // 关音乐：若金句仍挂着 aux，交回金句并续播（勿停金句却留黄标）。
      const aux = getShellAuxMediaOwner();
      if (aux?.id === "home-golden-verse") {
        void aux.resume();
      } else {
        refreshShellMediaSession({ playing: false });
      }
      const loadedTrack = tracks[trackIndexRef.current] ?? null;
      if (loadedTrack) {
        void persistMusicResume(loadedTrack.id, lastMusicProgressSecRef.current);
      }
      return;
    }

    clearShellMediaSessionUserDismissed();
    setShellMusicWantPlaying(true);
    playingStateRef.current = true;
    playbackModeRef.current = "music";
    setPlaybackMode("music");
    setPlaying(true);
    yieldAmbientIfVerseAndAmbientOpen();

    if (leavingScripture) {
      await stopScripturePlayback();
      if (!stillCurrent() || !getShellMusicWantPlaying()) return;
      playingStateRef.current = true;
      playbackModeRef.current = "music";
      setPlaybackMode("music");
      setPlaying(true);
    }

    /** 全程原生引擎（带 userPlay）；expo-av 分支已删。 */
    {
      try {
        await releaseScriptureShellForMusic(playbackModeRef, stopScripturePlayback);
        if (!stillCurrent() || !getShellMusicWantPlaying()) return;
        // 勿裸 resume：金句/读经后 contentKind 仍可能是 verse/scripture，
        // resume 会续错轨；一律 playTrackAt 重新 apply 音乐 payload。
        const playIdx = await syncMusicResumeForManualPlay({
          tracks,
          trackIndexRef,
          resumeTrackIdRef,
          resumePositionSecRef,
        });
        if (!stillCurrent() || !getShellMusicWantPlaying()) return;
        const resolvedIdx = resolveShellMusicPlayIndex(tracks, playIdx);
        const playTrack = tracks[resolvedIdx];
        if (!playTrack || !isTrackPlayable(playTrack)) {
          setShellMusicWantPlaying(false);
          playingStateRef.current = false;
          setPlaying(false);
          return;
        }
        if (isMobileBundledOnly() && !playTrack.localReady && !isTrackPlayable(playTrack)) {
          setShellMusicWantPlaying(false);
          playingStateRef.current = false;
          setPlaying(false);
          return;
        }
        const started = await playTrackAt(resolvedIdx);
        if (!stillCurrent()) return;
        if (!started || !getShellMusicWantPlaying()) {
          setShellMusicWantPlaying(false);
          playingStateRef.current = false;
          setPlaying(false);
          pauseShellAppMusic();
          return;
        }
        // playTrackAt 已带 userPlay；再 resume 一次，避免原生仍停在金句 pause 留下的 userPaused。
        resumeShellAppMusic();
      } catch (err) {
        logShellSoundError("togglePlayMusic-native", err);
        if (!stillCurrent()) return;
        setShellMusicWantPlaying(false);
        playingStateRef.current = false;
        setPlaying(false);
      }
      return;
    }
  }, [
    lastMusicProgressSecRef,
    musicGainRef,
    persistMusicResume,
    playTrackAt,
    playbackModeRef,
    playing,
    playingStateRef,
    resumePositionSecRef,
    resumeTrackIdRef,
    setMusicCurrentSec,
    setMusicDurationSec,
    setPlaybackMode,
    setPlaying,
    soundRef,
    stopScripturePlayback,
    trackIndex,
    trackIndexRef,
    tracks,
  ]);
}
