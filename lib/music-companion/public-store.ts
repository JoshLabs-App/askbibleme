import type { AudioTrack, MusicCompanionStore } from "./types";

export function isMusicTrackPublic(track: AudioTrack): boolean {
  return track.hidden !== true;
}

/** 前台 / App 用户可见曲库：去掉 hidden 曲目，并清理场景中对隐藏曲的引用。 */
export function filterPublicMusicCompanionStore(store: MusicCompanionStore): MusicCompanionStore {
  const audioTracks = store.audioTracks.filter(isMusicTrackPublic);
  const visibleIds = new Set(audioTracks.map((t) => t.id));
  return {
    ...store,
    audioTracks,
    scenes: store.scenes.map((scene) => ({
      ...scene,
      audioTrackId:
        scene.audioTrackId && visibleIds.has(scene.audioTrackId) ? scene.audioTrackId : null,
    })),
  };
}
