import type { MusicPlaybackMode } from "./musicPlaybackTypes";

export type MusicPlaybackControlSnapshot = {
  playing: boolean;
  playbackMode: MusicPlaybackMode;
  togglePlayScripture: (opts?: { forcePause?: boolean }) => Promise<boolean>;
};

const musicPlaybackControlSnapshot: MusicPlaybackControlSnapshot = {
  playing: false,
  playbackMode: "music",
  togglePlayScripture: async () => false,
};

/** 读经设置等低频 UI：读取播放快照，避免订阅整段进度导致每秒重渲染。 */
export function getMusicPlaybackControlSnapshot(): MusicPlaybackControlSnapshot {
  return musicPlaybackControlSnapshot;
}

export function syncMusicPlaybackControlSnapshot(
  playing: boolean,
  playbackMode: MusicPlaybackMode,
  togglePlayScripture: (opts?: { forcePause?: boolean }) => Promise<boolean>,
) {
  musicPlaybackControlSnapshot.playing = playing;
  musicPlaybackControlSnapshot.playbackMode = playbackMode;
  musicPlaybackControlSnapshot.togglePlayScripture = togglePlayScripture;
}
