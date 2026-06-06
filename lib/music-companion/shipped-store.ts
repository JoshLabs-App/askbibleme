import shippedCatalog from "@/data/music-companion.json";
import type { MusicCompanionStore } from "./types";

/** 随仓库发布的曲库快照；Web 壳层首屏 bootstrap，API 磁盘读失败时也可作展示回退。 */
export const shippedMusicCompanionStore = shippedCatalog as MusicCompanionStore;

export function musicCompanionStoreHasPlayableTracks(store: MusicCompanionStore | null): boolean {
  if (!store) return false;
  return store.audioTracks.some((t) => Boolean(t.src?.trim()));
}
