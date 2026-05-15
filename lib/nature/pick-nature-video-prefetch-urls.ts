import type { NatureSettingsV2 } from "./types";
import { isPrefetchableNatureVideoSrc } from "./is-prefetchable-nature-video-src";
import { resolveNatureVideoSrcForEntry } from "./resolve-nature-playback";

/** 配置列表中前 `limit` 条可预取的视频地址（去重，顺序与配置一致） */
export function pickNatureVideoPrefetchUrls(
  settings: NatureSettingsV2,
  limit = 5,
  prefer1080 = false,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of settings.videos) {
    const u = resolveNatureVideoSrcForEntry(v, prefer1080).trim();
    if (!u || seen.has(u) || !isPrefetchableNatureVideoSrc(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}
