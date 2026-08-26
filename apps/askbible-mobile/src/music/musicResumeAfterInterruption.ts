import type { Audio } from "expo-av";
import type { MutableRefObject } from "react";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { safeGetSoundStatus, safePlaySound } from "../audio/safeShellSound";
import { clearShellMediaSessionUserDismissed } from "../audio/shellMediaControls";
import { getShellMusicWantPlaying, setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { getShellAudioInterrupted } from "../audio/shellAudioInterruption";
import { isShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";

export type MusicBackgroundRecoveryCtx = {
  playbackModeRef: MutableRefObject<"music" | "scripture">;
  soundRef: MutableRefObject<Audio.Sound | null>;
  playingStateRef: MutableRefObject<boolean>;
  musicGainRef: MutableRefObject<number>;
  setPlaying: (playing: boolean) => void;
};

/**
 * 锁屏 / 打断后：若用户仍要听歌且轨已加载但未在播，强制重开 AudioMode 并 play。
 */
export async function recoverMusicPlaybackAfterBackground(
  ctx: MusicBackgroundRecoveryCtx,
): Promise<boolean> {
  if (ctx.playbackModeRef.current !== "music") return false;
  // 只认用户意图：点暂停后 wantPlaying=false；勿用 playingStateRef（渲染同步会短暂刷回 true 导致又续播）。
  if (!getShellMusicWantPlaying()) return false;
  if (getShellAudioInterrupted()) return false;
  // 锁屏原生接管中：勿用 expo-av 抢播。
  if (isShellNativeAudioTakeover()) return true;

  const sound = ctx.soundRef.current;
  if (!sound) return false;

  const st = await safeGetSoundStatus(sound);
  if (!st?.isLoaded) return false;
  if (st.isPlaying) {
    setShellMusicWantPlaying(true);
    ctx.playingStateRef.current = true;
    ctx.setPlaying(true);
    return true;
  }

  const durationMs = st.durationMillis ?? 0;
  const positionMs = st.positionMillis ?? 0;
  if (durationMs > 1500 && positionMs >= durationMs - 1200) {
    return false;
  }

  try {
    await configureShellAudioMode({ force: false });
    clearShellMediaSessionUserDismissed();
    setShellMusicWantPlaying(true);
    await sound.setIsMutedAsync(false);
    await sound.setVolumeAsync(ctx.musicGainRef.current);
    let ok = await safePlaySound(sound);
    if (!ok) {
      await configureShellAudioMode({ force: true });
      ok = await safePlaySound(sound);
    }
    if (ok) {
      ctx.playingStateRef.current = true;
      ctx.setPlaying(true);
    }
    return ok;
  } catch {
    return false;
  }
}
