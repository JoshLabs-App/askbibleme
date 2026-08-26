import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, type AppStateStatus } from "react-native";
import { getShellAudioInterrupted } from "../audio/shellAudioInterruption";
import { getShellMusicWantPlaying, subscribeShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { isNativeMainTrackOs, isShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import {
  recoverMusicPlaybackAfterBackground,
  type MusicBackgroundRecoveryCtx,
} from "./musicResumeAfterInterruption";

type Args = MusicBackgroundRecoveryCtx & {
  playing: boolean;
};

function shouldRecoverMusic(ctx: MusicBackgroundRecoveryCtx, _playing: boolean): boolean {
  if (ctx.playbackModeRef.current !== "music") return false;
  // 与 recoverMusicPlaybackAfterBackground 一致：仅 wantPlaying，避免暂停后被 UI 旧态拉回。
  return getShellMusicWantPlaying();
}

/** 音乐：锁屏/后台被系统掐掉后自动续播（对齐读经 interruption recovery）。 */
export function useMusicInterruptionRecovery({ playing, ...ctx }: Args): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    // 原生独占：后台勿 2s 轮询（会拖高 JS CPU）。
    if (isNativeMainTrackOs()) return;
    if (!shouldRecoverMusic(ctxRef.current, playing)) return;

    const tick = () => {
      if (getShellAudioInterrupted()) return;
      if (!shouldRecoverMusic(ctxRef.current, playingRef.current)) return;
      void recoverMusicPlaybackAfterBackground(ctxRef.current);
    };

    tick();
    const interval = setInterval(tick, playing || getShellMusicWantPlaying() ? 2000 : 1200);
    const unsubWant = subscribeShellMusicWantPlaying(() => {
      if (shouldRecoverMusic(ctxRef.current, playingRef.current)) tick();
    });
    return () => {
      clearInterval(interval);
      unsubWant();
    };
  }, [playing]);

  useEffect(() => {
    const sync = (state: AppStateStatus) => {
      if (getShellAudioInterrupted()) return;
      // 原生：只在回前台时补一次；后台交给原生播放器。
      if (isNativeMainTrackOs()) {
        if (state !== "active") return;
        if (!shouldRecoverMusic(ctxRef.current, playingRef.current)) return;
        if (isShellNativeAudioTakeover()) return;
        void recoverMusicPlaybackAfterBackground(ctxRef.current);
        return;
      }
      if (state !== "active" && state !== "inactive" && state !== "background") return;
      if (!shouldRecoverMusic(ctxRef.current, playingRef.current)) return;
      void recoverMusicPlaybackAfterBackground(ctxRef.current);
    };
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const onNative = () => {
      if (getShellAudioInterrupted()) return;
      if (!shouldRecoverMusic(ctxRef.current, playingRef.current)) return;
      // 原生已在播：勿再走 expo-av recover。
      if (isNativeMainTrackOs() && isShellNativeAudioTakeover()) return;
      void recoverMusicPlaybackAfterBackground(ctxRef.current);
    };
    const onBegan = () => {
      const sound = ctxRef.current.soundRef.current;
      if (!sound) return;
      void sound.pauseAsync().catch(() => {});
    };
    const sub = DeviceEventEmitter.addListener("AudioSessionInterruptionEnded", onNative);
    const began = DeviceEventEmitter.addListener("AudioSessionInterruptionBegan", onBegan);
    const pulse = DeviceEventEmitter.addListener("ShellMediaPlaybackPulse", onNative);
    return () => {
      sub.remove();
      began.remove();
      pulse.remove();
    };
  }, []);
}
