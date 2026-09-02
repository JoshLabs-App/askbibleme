import type { AudioPlayer } from "expo-audio";
import { toLegacyPlaybackStatus, type LegacyPlaybackStatus } from "./legacyPlaybackStatus";

/** expo-audio 在 unload / 切源并发时常见；避免冒泡成红屏 Uncaught (in promise)。 */
export function isBenignShellSoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /interrupt|not loaded|not yet loaded|Seeking/i.test(msg);
}

export function logShellSoundError(scope: string, err: unknown): void {
  if (!__DEV__ || isBenignShellSoundError(err)) return;
  console.warn(`[playback] ${scope}`, err);
}

/** 返回值沿用 expo-av 时代的毫秒制字段名（positionMillis/durationMillis/isPlaying），
 * 供仍按该形状读状态的调用方零改动接入；单位换算只在这一处发生。 */
export async function safeGetSoundStatus(
  player: AudioPlayer,
): Promise<LegacyPlaybackStatus | null> {
  try {
    return toLegacyPlaybackStatus(player.currentStatus, player.volume, player.muted);
  } catch (err) {
    logShellSoundError("getStatus", err);
    return null;
  }
}

export async function safePauseSound(player: AudioPlayer): Promise<void> {
  try {
    if (!player.isLoaded) return;
    // 真机上 playing 偶发误报 false，若再 gate 会「点暂停不停」。已加载则一律 pause。
    player.pause();
    // expo-av 时代这里靠 setStatusAsync 兜底二次确认；expo-audio 的 pause() 是同步原生调用，
    // 但新库在真机上的行为还没被长期验证过，保留同样的「pause 后复检、没停就重试一次」防御。
    if (player.playing) {
      try {
        player.pause();
      } catch (retryErr) {
        logShellSoundError("pause-retry", retryErr);
      }
    }
  } catch (err) {
    logShellSoundError("pause", err);
  }
}

export async function safePlaySound(player: AudioPlayer): Promise<boolean> {
  const attempt = (): boolean => {
    if (!player.isLoaded) return false;
    player.play();
    return true;
  };
  try {
    return attempt();
  } catch (err) {
    if (!isBenignShellSoundError(err)) {
      try {
        // 不在 retry 里切到 music/DuckOthers：金句后台续播会被三星 AudioHardening 静音。
        return attempt();
      } catch (retryErr) {
        logShellSoundError("play-retry", retryErr);
      }
    }
    logShellSoundError("play", err);
    return false;
  }
}

export async function safeStopAndUnloadSound(player: AudioPlayer): Promise<void> {
  try {
    player.pause();
    await player.seekTo(0);
  } catch (err) {
    logShellSoundError("stop", err);
  }
  try {
    player.remove();
  } catch (err) {
    logShellSoundError("unload", err);
  }
}

export async function safeSeekSoundRatio(player: AudioPlayer, ratio: number): Promise<boolean> {
  try {
    if (!player.isLoaded || !(player.duration > 0)) return false;
    const clamped = Math.max(0, Math.min(1, ratio));
    await player.seekTo(clamped * player.duration);
    return true;
  } catch (err) {
    logShellSoundError("seek", err);
    return false;
  }
}

