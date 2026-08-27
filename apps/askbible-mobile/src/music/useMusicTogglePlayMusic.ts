import { useCallback, useRef } from "react";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
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
      playbackMode: playbackModeRef.current,
      musicWantPlaying: getShellMusicWantPlaying(),
      musicNativePlaying: getShellMusicNativePlaying(),
      playing,
      playingState: playingStateRef.current,
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
      if (isNativeMainTrackOs()) {
        const loadedTrack = tracks[trackIndexRef.current] ?? null;
        if (loadedTrack) {
          void persistMusicResume(loadedTrack.id, lastMusicProgressSecRef.current);
        }
        return;
      }
      try {
        const sound = soundRef.current;
        const stBefore = sound ? await safeGetSoundStatus(sound) : null;
        if (!stillCurrent()) return;
        const loadedTrack = tracks[trackIndexRef.current] ?? null;
        if (sound && stBefore?.isLoaded) {
          const useCalmFade = shouldUseCalmAlbumFade(loadedTrack);
          if (useCalmFade) {
            const fromVolume =
              typeof stBefore.volume === "number" ? stBefore.volume : musicGainRef.current;
            await fadeSoundVolume(sound, fromVolume, 0, 0);
            if (!stillCurrent()) return;
          }
          await safePauseSound(sound);
          if (!stillCurrent()) return;
          if (useCalmFade) {
            try {
              await sound.setVolumeAsync(musicGainRef.current);
            } catch {
              /* ignore restore failures */
            }
          }
          if (loadedTrack) {
            await persistMusicResume(loadedTrack.id, stBefore.positionMillis / 1000);
          }
        }
        playingStateRef.current = false;
        setPlaying(false);
        // 暂停音轨后再确认一次金句主会话（防止中途被 music 进度刷回去）。
        const auxAfter = getShellAuxMediaOwner();
        if (auxAfter?.id === "home-golden-verse") {
          void auxAfter.resume();
        }
      } catch (err) {
        logShellSoundError("togglePlayMusic-pause", err);
        setShellMusicWantPlaying(false);
        playingStateRef.current = false;
        setPlaying(false);
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

    // iOS / Android：全程原生引擎（带 userPlay）；勿再走 expo-av。
    if (isNativeMainTrackOs()) {
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

    try {
      await configureShellAudioMode({ force: true });
      if (!stillCurrent() || !getShellMusicWantPlaying()) return;

      const sound = soundRef.current;
      const st = sound ? await safeGetSoundStatus(sound) : null;
      if (!stillCurrent() || !getShellMusicWantPlaying()) return;
      const loadedTrack = tracks[trackIndexRef.current] ?? null;
      const musicLoaded = Boolean(
        loadedTrack && sound && st?.isLoaded && playbackModeRef.current === "music",
      );

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

      const sameLoadedTrack = Boolean(
        musicLoaded && sound && st?.isLoaded && loadedTrack?.id === playTrack.id,
      );

      if (
        canResumeExistingMusicSound({ leavingScripture, sameLoadedTrack }) &&
        sound &&
        st?.isLoaded
      ) {
        const resumeSec =
          resumeTrackIdRef.current === playTrack.id
            ? Math.max(0, resumePositionSecRef.current)
            : 0;
        if (resumeSec > 0.5 && (st.positionMillis ?? 0) < 400) {
          try {
            await sound.setPositionAsync(Math.floor(resumeSec * 1000));
            lastMusicProgressSecRef.current = resumeSec;
            setMusicCurrentSec(resumeSec);
          } catch {
            /* ignore seek failures; still try play */
          }
        }
        if (!stillCurrent() || !getShellMusicWantPlaying()) return;

        const fadeForPlay = shouldUseCalmAlbumFade(playTrack);
        if (fadeForPlay) {
          try {
            await sound.setVolumeAsync(0);
          } catch {
            /* ignore pre-play fade setup failures */
          }
        }
        try {
          await sound.setIsMutedAsync(false);
          if (!fadeForPlay) {
            await sound.setVolumeAsync(musicGainRef.current);
          }
        } catch {
          /* ignore */
        }
        const ok = await safePlaySound(sound);
        if (!stillCurrent() || !getShellMusicWantPlaying()) return;
        if (ok) {
          const resumed = await safeGetSoundStatus(sound);
          const resumedPlaying = !!(resumed && resumed.isLoaded ? resumed.isPlaying : false);
          if (resumedPlaying) {
            if (fadeForPlay) {
              await fadeSoundVolume(sound, 0, musicGainRef.current, 0);
            } else {
              try {
                await sound.setVolumeAsync(musicGainRef.current);
              } catch {
                /* ignore */
              }
            }
          }
          if (!stillCurrent() || !getShellMusicWantPlaying()) return;
          setPlaying(true);
          const posSec =
            (resumed?.isLoaded ? resumed.positionMillis : null) ?? st.positionMillis;
          lastMusicProgressSecRef.current = posSec / 1000;
          setMusicCurrentSec(posSec / 1000);
          const durMs =
            (resumed?.isLoaded ? resumed.durationMillis : null) ?? st.durationMillis;
          if (durMs != null) {
            setMusicDurationSec(durMs / 1000);
          }
          refreshShellMediaSession({
            playing: true,
            musicCurrentSec: posSec / 1000,
            ...(durMs != null ? { musicDurationSec: durMs / 1000 } : {}),
          });
          return;
        }
      }

      if (!stillCurrent() || !getShellMusicWantPlaying()) return;
      await releaseScriptureShellForMusic(playbackModeRef, stopScripturePlayback);
      if (!stillCurrent() || !getShellMusicWantPlaying()) return;
      const started = await playTrackAt(resolvedIdx);
      if (!stillCurrent()) return;
      if (!started || !getShellMusicWantPlaying()) {
        setShellMusicWantPlaying(false);
        playingStateRef.current = false;
        setPlaying(false);
      }
    } catch (err) {
      logShellSoundError("togglePlayMusic", err);
      if (!stillCurrent()) return;
      setShellMusicWantPlaying(false);
      playingStateRef.current = false;
      setPlaying(false);
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
