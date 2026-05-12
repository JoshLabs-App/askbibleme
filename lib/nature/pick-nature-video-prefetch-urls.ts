import type { NatureSettingsV2 } from "./types";
import { isPrefetchableNatureVideoSrc } from "./is-prefetchable-nature-video-src";

/** 配置列表中前 `limit` 条可预取的视频地址（去重，顺序与配置一致） */
export function pickNatureVideoPrefetchUrls(settings: NatureSettingsV2, limit = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of settings.videos) {
    const u = typeof v.src === "string" ? v.src.trim() : "";
    if (!u || seen.has(u) || !isPrefetchableNatureVideoSrc(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}
