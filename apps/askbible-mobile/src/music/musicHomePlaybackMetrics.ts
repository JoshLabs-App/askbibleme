type Args = {
  playbackMode: "music" | "scripture";
  musicDurationSec: number;
  musicCurrentSec: number;
  seekDragging: boolean;
  seekPreview: number;
  playing: boolean;
  isFocused: boolean;
};

export function resolveMusicHomePlaybackMetrics({
  playbackMode,
  musicDurationSec,
  musicCurrentSec,
  seekDragging,
  seekPreview,
  playing,
  isFocused,
}: Args) {
  const musicActive = playbackMode === "music";
  const albumDecorVisible = musicActive;
  const albumDecorMotionActive = musicActive && playing && isFocused;
  const duration = musicActive && musicDurationSec > 0 ? musicDurationSec : 0;
  const position = musicActive ? (seekDragging ? seekPreview * (duration || 1) : musicCurrentSec) : 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return { musicActive, albumDecorVisible, albumDecorMotionActive, duration, position, progress };
}
