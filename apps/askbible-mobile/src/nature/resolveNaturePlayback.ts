import type { NatureSettingsV2, NatureVideoEntry } from "../types/nature";

function videoSrcForEntry(entry: NatureVideoEntry | undefined): string {
  if (!entry) return "";
  return entry.src.trim();
}

/** 自然场景成片播放（固定 720p `src`）；环境声层暂未在 App 启用。 */
export function resolveNaturePlayback(
  s: NatureSettingsV2,
): {
  videoSrc: string;
  posterSrc?: string;
  previewStillSrc?: string;
  ambientLayers: { layerId: string; src: string; volume: number }[];
} {
  const posterSrc = s.posterSrc?.trim();
  if (!s.videos.length) {
    return { videoSrc: "", ambientLayers: [], ...(posterSrc ? { posterSrc } : {}) };
  }
  const want = (s.activeVideoId ?? "").trim();
  const hit = want ? s.videos.find((v) => v.id === want) : undefined;
  const row = hit ?? s.videos[0];
  const videoSrc = videoSrcForEntry(row);
  const rowThumb = row?.thumbSrc?.trim();
  const rowPreview = row?.previewFrameSrc?.trim();
  const posterFromRow =
    (rowPreview && rowPreview.length > 0 ? rowPreview : undefined) ??
    (rowThumb && rowThumb.length > 0 ? rowThumb : undefined);
  const previewStillSrc = posterFromRow;
  const posterSrcMerged = posterFromRow ?? posterSrc;
  return {
    videoSrc,
    ambientLayers: [],
    ...(previewStillSrc ? { previewStillSrc } : {}),
    ...(posterSrcMerged ? { posterSrc: posterSrcMerged } : {}),
  };
}
