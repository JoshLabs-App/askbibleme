import type { MusicCompanionStore, Scene } from "./types";

function pickScene(store: MusicCompanionStore): Scene | null {
  const { scenes, defaultSceneId } = store;
  if (scenes.length === 0) return null;
  if (defaultSceneId) {
    const s = scenes.find((x) => x.id === defaultSceneId);
    if (s) return s;
  }
  return [...scenes].sort((a, b) => a.order - b.order)[0] ?? null;
}

/**
 * 默认场景绑定的曲目 URL（稳定、可预期）。
 * 用于恢复进度时判断「是否等于场景默认曲」以决定是否清除 override，勿用随机默认比较。
 */
export function getShellSceneBoundAudioSrc(store: MusicCompanionStore): string | null {
  const scene = pickScene(store);
  const tracksWithSrc = store.audioTracks.filter((t) => t.src?.trim());
  if (tracksWithSrc.length === 0) return null;
  const want = scene?.audioTrackId ?? null;
  const i = want ? tracksWithSrc.findIndex((t) => t.id === want) : -1;
  const track = i >= 0 ? tracksWithSrc[i] : tracksWithSrc[0];
  return track.src?.trim() ?? null;
}

/**
 * 壳层「默认播放」URL：多曲时在池内随机；单曲则唯一一条。
 * 每次 `store` 更新或 `togglePlay` 在曲首/曲尾起播时会重新随机（见 `MusicShellPlaybackContext`）。
 */
export function getShellDefaultAudioSrc(store: MusicCompanionStore): string | null {
  const tracksWithSrc = store.audioTracks.filter((t) => t.src?.trim());
  if (tracksWithSrc.length === 0) return null;
  if (tracksWithSrc.length === 1) return tracksWithSrc[0].src?.trim() ?? null;
  const i = Math.floor(Math.random() * tracksWithSrc.length);
  return tracksWithSrc[i]?.src?.trim() ?? null;
}
