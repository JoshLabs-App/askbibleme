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
 * 底栏「一键播放」与音乐首页默认池一致：优先默认场景绑定的曲目，否则有 src 的第一条。
 */
export function getShellDefaultAudioSrc(store: MusicCompanionStore): string | null {
  const scene = pickScene(store);
  const tracksWithSrc = store.audioTracks.filter((t) => t.src?.trim());
  if (tracksWithSrc.length === 0) return null;
  const want = scene?.audioTrackId ?? null;
  const i = want ? tracksWithSrc.findIndex((t) => t.id === want) : -1;
  const track = i >= 0 ? tracksWithSrc[i] : tracksWithSrc[0];
  return track.src?.trim() ?? null;
}
