import type { NatureSettingsV2 } from "../types/nature";

export function resolveNaturePlayback(s: NatureSettingsV2): {
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
  const videoSrc = row?.src.trim() ?? "";
  const rowThumb = row?.thumbSrc?.trim();
  const rowPreview = row?.previewFrameSrc?.trim();
  const posterFromRow =
    (rowPreview && rowPreview.length > 0 ? rowPreview : undefined) ??
    (rowThumb && rowThumb.length > 0 ? rowThumb : undefined);
  const previewStillSrc = posterFromRow;
  /**
   * 与 Web `lib/nature/nature-video-ambient-audio.ts` 产品默认一致：自然主视频不叠环境声，
   * 直至提供用户开关后再与 Web 共用 `NATURE_VIDEO_AMBIENT_AUDIO_ENABLED` / 混音构建逻辑。
   */
  const ambientLayers: { layerId: string; src: string; volume: number }[] = [];
  const posterSrcMerged = posterFromRow ?? posterSrc;
  return {
    videoSrc,
    ambientLayers,
    ...(previewStillSrc ? { previewStillSrc } : {}),
    ...(posterSrcMerged ? { posterSrc: posterSrcMerged } : {}),
  };
}
