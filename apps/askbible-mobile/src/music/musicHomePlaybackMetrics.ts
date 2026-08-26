type Args = {
  playbackMode: "music" | "scripture";
  musicDurationSec: number;
  playing: boolean;
  isFocused: boolean;
  appForeground: boolean;
};

/** 只放跟播放位置无关的量；position / progress 由 MusicHomeScrubber 自己订阅计算。 */
export function resolveMusicHomePlaybackMetrics({
  playbackMode,
  musicDurationSec,
  playing,
  isFocused,
  appForeground,
}: Args) {
  const musicActive = playbackMode === "music";
  const albumDecorVisible = musicActive;
  const albumDecorMotionActive = musicActive && playing && isFocused && appForeground;
  const duration = musicActive && musicDurationSec > 0 ? musicDurationSec : 0;

  return { musicActive, albumDecorVisible, albumDecorMotionActive, duration };
}
