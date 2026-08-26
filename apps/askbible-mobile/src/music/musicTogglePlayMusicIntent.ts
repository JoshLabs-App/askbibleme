/** 首页 / 音乐键：暂停只看音乐会话，不把读经的 shared `playing` 当成音乐在播。 */
export function isMusicTogglePauseIntent(args: {
  playbackMode: "music" | "scripture";
  musicWantPlaying: boolean;
  musicNativePlaying: boolean;
  playing: boolean;
  playingState: boolean;
}): boolean {
  if (args.playbackMode !== "music") return false;
  return args.musicWantPlaying || args.musicNativePlaying || args.playingState || args.playing;
}

/**
 * 安卓 music/scripture 共用 soundRef。读经刚切到 music 时，已加载的轨仍是章朗读，
 * 不能按「同一首音乐」续播，否则首页音乐键会去控读经。
 */
export function canResumeExistingMusicSound(args: {
  leavingScripture: boolean;
  sameLoadedTrack: boolean;
}): boolean {
  return !args.leavingScripture && args.sameLoadedTrack;
}
