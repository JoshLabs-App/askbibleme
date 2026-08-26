import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { mergeMusicCompanionTrackDisplay } from "../../../../lib/music-companion/merge-track-display-shared";
import { getBundledMusicCompanionStore } from "./musicCompanionBundled";
import type { MusicCompanionStore } from "./types";

function normalizeRemoteStoreUrls(store: MusicCompanionStore, baseUrl: string): MusicCompanionStore {
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
  if (isMobileBundledOnly()) return null;
  if (!(await isNetworkAvailable())) return null;
  const primaryBase = getAskBibleBaseUrl().replace(/\/$/, "");
  // 音乐 companion 不经 askbible.me。
  if (!primaryBase || /askbible\.me/i.test(primaryBase)) return null;
  const candidates = [primaryBase];

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
