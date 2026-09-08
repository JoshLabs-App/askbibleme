/**
 * 首页 / 音乐键：这一下是暂停还是播放。
 *
 * **只问音乐这一条流。** 以前要凑四个来源（`musicWantPlaying`、`musicNativePlaying`、
 * 本地 `playingState`、共用 `playing`）才敢下判断，正是因为没有一个能单独说清「音乐在不在响」；
 * 凑出来的答案又会被别的流污染——金句在播时共用 `playing` 为真，点音乐就变成了暂停。
 * 现在原生按流上报，直接读它。
 */
export function isMusicTogglePauseIntent(args: { musicPlaying: boolean }): boolean {
  return args.musicPlaying;
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
