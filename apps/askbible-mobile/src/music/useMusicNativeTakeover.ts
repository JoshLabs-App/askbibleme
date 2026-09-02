import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, type AppStateStatus } from "react-native";
import { safePauseSound } from "../audio/safeShellSound";
import { SHELL_MUSIC_PAUSE_FOR_AUX } from "../audio/pauseShellMusicForAux";
import { pauseShellAppMusic } from "../audio/shellMediaControls";
import { setShellMusicNativePlaying } from "../audio/shellMusicNativePlaying";
import { getShellMusicWantPlaying, setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { isNativeMainTrackOs, setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { syncPlaybackWidgetForceIdleMusic } from "../widget/readingAudioWidget";
import { applyIosNativeScriptureProgress } from "./applyIosNativeScriptureProgress";
import type { MusicBackgroundRecoveryCtx } from "./musicResumeAfterInterruption";
import { setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";

type Args = MusicBackgroundRecoveryCtx & {
  setMusicCurrentSec?: (sec: number) => void;
  setMusicDurationSec?: (sec: number) => void;
  setScriptureCurrentSec?: (sec: number) => void;
  setScriptureDurationSec?: (sec: number) => void;
  scripturePlaybackRateRef?: { current: number };
  pauseShellPlayback?: () => Promise<void>;
};

/**
 * iOS：music 由原生 AVAudioPlayer 独占。JS 侧 pause expo-av，进度听 NativeProgress。
 * 不再在回前台时 release（避免交回哑掉的 expo-av）。
 */
export function useMusicNativeTakeover(ctx: Args): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    const onTakeover = () => {
      // 用户已点停时勿被 Takeover 又拉回 wantPlaying。
      if (!getShellMusicWantPlaying()) return;
      setShellNativeAudioTakeover(true);
      // 停 JS 音乐轨；环境音继续混播（含锁屏）。
      const sound = ctxRef.current.soundRef.current;
      if (sound) void safePauseSound(sound);
    };

    const onProgress = (payload?: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const playing = (payload as { playing?: unknown }).playing;
      const progressKind = String((payload as { kind?: unknown }).kind ?? "");
      // 读经占用同一原生 AVPlayer：进度属于读经本身，写回时长/时钟，勿当音乐处理。
      // kind=music 是遗留 NativeMusicEngine 心跳，即使当时 playbackMode 仍是 scripture 也丢掉。
      const scriptureProgress =
        progressKind === "scripture" ||
        (ctxRef.current.playbackModeRef.current === "scripture" && progressKind !== "music");
      if (scriptureProgress) {
        setShellMusicNativePlaying(false);
        applyIosNativeScriptureProgress(payload, ctxRef.current);
        return;
      }
      // 仍要听歌时勿被偶发 playing=false（金句开轨瞬间）把 UI 黄标打灭。
      if (playing === false) {
        setShellMusicNativePlaying(false);
        return;
      }
      if (playing !== true) return;
      // 未点音乐：环境音 / 金句 / 预加载进度不得开音乐黄标，也不得把 wantPlaying 拉起来。
      if (!getShellMusicWantPlaying()) {
        return;
      }
      if (progressKind === "verse" || progressKind === "ambient") {
        return;
      }
      setShellMusicNativePlaying(true);
      setShellNativeAudioTakeover(true);
      const pos = Number((payload as { positionSec?: unknown }).positionSec);
      const dur = Number((payload as { durationSec?: unknown }).durationSec);
      const c = ctxRef.current;
      if (Number.isFinite(pos) && pos >= 0) {
        c.setMusicCurrentSec?.(pos);
      }
      if (Number.isFinite(dur) && dur > 0) {
        c.setMusicDurationSec?.(dur);
      }
      c.playingStateRef.current = true;
      c.setPlaying(true);
    };

    const onStopped = () => {
      setShellMusicNativePlaying(false);
      setShellNativeAudioTakeover(false);
      setShellMusicWantPlaying(false);
      const c = ctxRef.current;
      if (c.playbackModeRef.current === "scripture") {
        setScripturePlaybackClockPlaying(false);
      }
      c.playingStateRef.current = false;
      c.setPlaying(false);
      syncPlaybackWidgetForceIdleMusic();
    };

    const onRelease = () => {
      setShellMusicNativePlaying(false);
      setShellNativeAudioTakeover(false);
    };

    const onPauseForAux = () => {
      const c = ctxRef.current;
      setShellMusicNativePlaying(false);
      setShellMusicWantPlaying(false);
      setShellNativeAudioTakeover(false);
      c.playingStateRef.current = false;
      c.setPlaying(false);
      // 读经等 aux 抢播：必须停原生，否则出现「有声无黄标」。
      pauseShellAppMusic();
      const pause = c.pauseShellPlayback;
      if (pause) {
        void pause();
        return;
      }
      const sound = c.soundRef.current;
      if (sound) void safePauseSound(sound);
    };

    const subTake = DeviceEventEmitter.addListener("ShellMediaNativeTakeover", onTakeover);
    const subProgress = DeviceEventEmitter.addListener("ShellMediaNativeProgress", onProgress);
    const subStopped = DeviceEventEmitter.addListener("ShellMediaNativeStopped", onStopped);
    const subRelease = DeviceEventEmitter.addListener("ShellMediaNativeRelease", onRelease);
    const subAux = DeviceEventEmitter.addListener(SHELL_MUSIC_PAUSE_FOR_AUX, onPauseForAux);
    return () => {
      subTake.remove();
      subProgress.remove();
      subStopped.remove();
      subRelease.remove();
      subAux.remove();
      setShellMusicNativePlaying(false);
      setShellNativeAudioTakeover(false);
    };
  }, []);

  // 仅壳层音乐后台时丢掉 JS 侧 expo-av 轨引用（原生引擎继续播）。环境音关屏后不停。
  useEffect(() => {
    if (!isNativeMainTrackOs()) return;
    const sync = (state: AppStateStatus) => {
      if (state === "active") return;
      if (!getShellMusicWantPlaying()) return;
      const sound = ctxRef.current.soundRef.current;
      if (sound) {
        void safePauseSound(sound);
        ctxRef.current.soundRef.current = null;
        try {
          sound.remove();
        } catch {
          /* ignore */
        }
      }
    };
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, []);
}
