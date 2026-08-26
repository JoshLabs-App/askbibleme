import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { buildMusicCompanionCatalogUrl } from "../media/musicAudioRemote";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { mergeMusicCompanionTrackDisplay } from "../../../../lib/music-companion/merge-track-display-shared";
import { getBundledMusicCompanionStore } from "./musicCompanionBundled";
import { filterPublicMusicCompanionStore } from "./publicMusicStore";
import type { MusicCompanionStore } from "./types";

function isMusicStoreShape(raw: unknown): raw is MusicCompanionStore {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.audioTracks) && Array.isArray(o.scenes);
}

/** 从 R2 拉曲目清单。src 保持 `/music/uploads/…`，播放仍走现有 R2 点播。 */
export async function fetchMusicCompanionStoreFromR2(): Promise<MusicCompanionStore | null> {
  const url = buildMusicCompanionCatalogUrl();
  if (!url) return null;
  if (!(await isNetworkAvailable())) return null;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
      timeoutMs: 3500,
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("application/json")) return null;
    const data = (await res.json()) as unknown;
    if (!isMusicStoreShape(data)) return null;
    const publicStore = filterPublicMusicCompanionStore(data);
    return mergeMusicCompanionTrackDisplay(publicStore, getBundledMusicCompanionStore());
  } catch {
    return null;
  }
}
