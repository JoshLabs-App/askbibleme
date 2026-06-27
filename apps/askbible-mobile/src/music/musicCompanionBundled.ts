import type { MusicCompanionStore } from "./types";
import { filterPublicMusicCompanionStore } from "./publicMusicStore";

const bundled = require("../../assets/content/music-companion.json") as MusicCompanionStore;

export function getBundledMusicCompanionStore(): MusicCompanionStore {
  return filterPublicMusicCompanionStore(bundled);
}
