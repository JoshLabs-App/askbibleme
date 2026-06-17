import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MusicCompanionStore } from "./types";

const MUSIC_STORE_CACHE_KEY = "askbible-music-companion-cache-v1";
const MUSIC_PLAYBACK_ACTIVATED_KEY = "askbible-music-playback-activated-v1";

function isMusicStoreShape(raw: unknown): raw is MusicCompanionStore {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.audioTracks) && Array.isArray(o.scenes);
}

export async function readCachedMusicCompanionStore(): Promise<MusicCompanionStore | null> {
  try {
    const raw = await AsyncStorage.getItem(MUSIC_STORE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isMusicStoreShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedMusicCompanionStore(store: MusicCompanionStore): Promise<void> {
  try {
    await AsyncStorage.setItem(MUSIC_STORE_CACHE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export async function hasMusicPlaybackActivated(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MUSIC_PLAYBACK_ACTIVATED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markMusicPlaybackActivated(): Promise<void> {
  try {
    await AsyncStorage.setItem(MUSIC_PLAYBACK_ACTIVATED_KEY, "1");
  } catch {
    /* ignore */
  }
}
