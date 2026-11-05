import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";
import { DEFAULT_MUSIC_ALBUM, inferTrackAlbumFromCompanionTrack } from "@/lib/music/album-playback";
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
 * Stable quiet-album default. A catalog refresh must not change an un-overridden song.
 * Other albums are reached through the user's selection, including a saved selection.
 */
export function getShellDefaultAudioSrc(store: MusicCompanionStore): string | null {
  const tracksWithSrc = store.audioTracks.filter((t) => t.src?.trim() && inferTrackAlbumFromCompanionTrack(t) === DEFAULT_MUSIC_ALBUM);
  if (tracksWithSrc.length === 0) return null;
  return tracksWithSrc[0].src?.trim() ?? null;
}

/**
 * 从曲库随机选一条可播 URL；多曲时尽量避开 `exceptUrl`（用于「下一首随机」）。
 */
export function pickRandomShellAudioTrackSrc(
  store: MusicCompanionStore,
  exceptUrl: string | null | undefined,
): string | null {
  const tracks = store.audioTracks.filter((t) => Boolean(t.src?.trim()));
  if (tracks.length === 0) return null;
  const ex = (exceptUrl ?? "").trim();
  if (tracks.length === 1) {
    const u = tracks[0]!.src!.trim();
    return u || null;
  }
  let pick = tracks[Math.floor(Math.random() * tracks.length)]!;
  for (let g = 0; g < 40; g++) {
    const u = (pick.src ?? "").trim();
    if (!ex || !shellPlaybackUrlsEqual(u, ex)) break;
    pick = tracks[Math.floor(Math.random() * tracks.length)]!;
  }
  return (pick.src ?? "").trim() || null;
}
