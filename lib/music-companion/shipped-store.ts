import shippedCatalog from "@/data/music-companion.json";
import { filterPublicMusicCompanionStore } from "./public-store";
import type { MusicCompanionStore } from "./types";

/** 随仓库发布的曲库快照；Web 壳层首屏 bootstrap，API 磁盘读失败时也可作展示回退。 */
export const shippedMusicCompanionStore = shippedCatalog as MusicCompanionStore;

/** 前台可见子集（排除 hidden 曲目）。 */
export const shippedPublicMusicCompanionStore = filterPublicMusicCompanionStore(
  shippedMusicCompanionStore,
);

export function musicCompanionStoreHasPlayableTracks(store: MusicCompanionStore | null): boolean {
  if (!store) return false;
  return store.audioTracks.some((t) => Boolean(t.src?.trim()));
}
