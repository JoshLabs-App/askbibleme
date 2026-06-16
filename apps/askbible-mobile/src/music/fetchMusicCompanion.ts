import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { mergeMusicCompanionTrackDisplay } from "./mergeTrackDisplay";
import type { MusicCompanionStore } from "./types";

const bundled = require("../../assets/content/music-companion.json") as MusicCompanionStore;
const MUSIC_STORE_CACHE_KEY = "askbible-music-companion-cache-v1";
const MUSIC_PLAYBACK_ACTIVATED_KEY = "askbible-music-playback-activated-v1";

function isMusicStoreShape(raw: unknown): raw is MusicCompanionStore {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.audioTracks) && Array.isArray(o.scenes);
}

export function getBundledMusicCompanionStore(): MusicCompanionStore {
  return bundled;
}

function normalizedTrackTitle(track: MusicCompanionStore["audioTracks"][number]): string {
  if (typeof track.title === "string") return track.title.trim();
  return (track.title["zh-CN"] || track.title.en || "").trim();
}

function storeSignature(store: MusicCompanionStore): string {
  const rows = store.audioTracks.map((track) => {
    const tags = Array.isArray(track.tags) ? track.tags.join(",") : "";
    return [
      track.id.trim(),
      (track.src || "").trim(),
      normalizedTrackTitle(track),
      tags.trim(),
      typeof track.remark === "string" ? track.remark.trim() : "",
    ].join("|");
  });
  return rows.sort().join(";");
}

export function isMusicCompanionStoreDifferent(
  nextStore: MusicCompanionStore | null | undefined,
  currentStore: MusicCompanionStore | null | undefined,
): boolean {
  if (!nextStore || !currentStore) return false;
  return storeSignature(nextStore) !== storeSignature(currentStore);
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

function isLocalLikeHostFromBase(base: string): boolean {
  try {
    const u = new URL(base);
    const h = u.hostname.trim().toLowerCase();
    if (!h) return true;
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
    if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m) {
      const octet = Number(m[1]);
      if (Number.isFinite(octet) && octet >= 16 && octet <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeRemoteStoreUrls(
  store: MusicCompanionStore,
  baseUrl: string,
): MusicCompanionStore {
  return {
    ...store,
    audioTracks: (store.audioTracks ?? []).map((t) => ({
      ...t,
      src: toAbsoluteUrl(baseUrl, t.src ?? ""),
      analysisSrc: t.analysisSrc?.trim() ? toAbsoluteUrl(baseUrl, t.analysisSrc) : t.analysisSrc,
    })),
    backgroundVisuals: (store.backgroundVisuals ?? []).map((v) =>
      v.type === "image" && v.imageSrc?.trim()
        ? { ...v, imageSrc: toAbsoluteUrl(baseUrl, v.imageSrc) }
        : v,
    ),
  };
}

export async function fetchMusicCompanionStoreFromRemote(): Promise<MusicCompanionStore | null> {
  if (!(await isNetworkAvailable())) return null;
  const primaryBase = getAskBibleBaseUrl();
  const candidates = [primaryBase];
  if (isLocalLikeHostFromBase(primaryBase) && !candidates.includes("https://askbible.me")) {
    candidates.push("https://askbible.me");
  }

  for (const base of candidates) {
    try {
      const res = await fetchWithTimeout(`${base}/api/music/companion`, {
        headers: { Accept: "application/json" },
        timeoutMs: 3500,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.ok && contentType.includes("application/json")) {
        const data = (await res.json()) as MusicCompanionStore;
        if (data?.audioTracks && Array.isArray(data.audioTracks)) {
          const merged = mergeMusicCompanionTrackDisplay(data, getBundledMusicCompanionStore());
          return normalizeRemoteStoreUrls(merged, base);
        }
      }
    } catch {
      /* 离线或本机未启动时忽略，继续尝试下一个候选 */
    }
  }
  return null;
}
