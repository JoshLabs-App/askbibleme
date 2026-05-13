import type { NatureSettingsV2 } from "./types";

export function resolveNaturePlayback(s: NatureSettingsV2): {
  videoSrc: string;
  posterSrc?: string;
  /** 预览条静态图：首帧 JPEG 优先，否则正方形 thumb；二者皆无时预览条回退为内联视频 */
  previewStillSrc?: string;
  /** 环境声层（当前前台恒为空数组；类型保留以兼容调用方）。 */
  ambientLayers: { layerId: string; src: string; volume: number }[];
} {
  const posterSrc = s.posterSrc?.trim();
  if (!s.videos.length) {
    return { videoSrc: "", ambientLayers: [], ...(posterSrc ? { posterSrc } : {}) };
  }
  const want = s.activeVideoId.trim();
  const hit = want ? s.videos.find((v) => v.id === want) : undefined;
  const row = hit ?? s.videos[0];
  const videoSrc = row?.src.trim() ?? "";
  const rowThumb = row?.thumbSrc?.trim();
  const rowPreview = row?.previewFrameSrc?.trim();
  const posterFromRow =
    (rowPreview && rowPreview.length > 0 ? rowPreview : undefined) ??
    (rowThumb && rowThumb.length > 0 ? rowThumb : undefined);
  const previewStillSrc = posterFromRow;
  /** 产品：自然主视频不再叠环境声轨（后台混音数据仍保留在 JSON，前台不播放）。 */
  const ambientLayers: { layerId: string; src: string; volume: number }[] = [];
  const posterSrcMerged = posterFromRow ?? posterSrc;
  return {
    videoSrc,
    ambientLayers,
    ...(previewStillSrc ? { previewStillSrc } : {}),
    ...(posterSrcMerged ? { posterSrc: posterSrcMerged } : {}),
  };
}
