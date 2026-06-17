import type { MusicCompanionStore } from "./types";

const bundled = require("../../assets/content/music-companion.json") as MusicCompanionStore;

export function getBundledMusicCompanionStore(): MusicCompanionStore {
  return bundled;
}
