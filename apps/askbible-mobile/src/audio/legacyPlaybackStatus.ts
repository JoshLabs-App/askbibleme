import type { AudioStatus } from "expo-audio";

/**
 * expo-audio 的 AudioStatus 用秒（currentTime/duration），expo-av 的 AVPlaybackStatus
 * 用毫秒（positionMillis/durationMillis）。播放状态机密集的文件（竞态/generation防护）
 * 迁移时只换这一层类型 + 转换点，不动内部业务逻辑，避免到处手动改单位引入静默bug。
 */
export type LegacyPlaybackStatus =
  | { isLoaded: false; error?: string }
  | {
      isLoaded: true;
      isPlaying: boolean;
      positionMillis: number;
      durationMillis: number;
      didJustFinish: boolean;
      isBuffering: boolean;
      volume: number;
      rate: number;
      isMuted: boolean;
    };

export function toLegacyPlaybackStatus(
  status: AudioStatus,
  volumeOverride?: number,
  mutedOverride?: boolean,
): LegacyPlaybackStatus {
  if (!status.isLoaded) return { isLoaded: false };
  return {
    isLoaded: true,
    isPlaying: status.playing,
    positionMillis: Math.max(0, Math.round(status.currentTime * 1000)),
    durationMillis: Math.max(0, Math.round(status.duration * 1000)),
    didJustFinish: status.didJustFinish,
    isBuffering: status.isBuffering,
    volume: volumeOverride ?? 1,
    rate: status.playbackRate,
    isMuted: mutedOverride ?? status.mute,
  };
}
