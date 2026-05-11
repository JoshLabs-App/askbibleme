import type { NatureSettingsV2 } from "./types";

export function resolveNaturePlayback(s: NatureSettingsV2): {
  videoSrc: string;
  posterSrc?: string;
  /** 预览条静态图：首帧 JPEG 优先，否则正方形 thumb；二者皆无时预览条回退为内联视频 */
  previewStillSrc?: string;
  /** 与当前活动影片对应的环境声层（已解析为 URL + 音量） */
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
  const clipById = new Map(s.ambientClips.map((c) => [c.id, c]));
  const mix = row?.mix ?? [];
  const ambientLayers = mix
    .map((layer) => {
      const clip = clipById.get(layer.clipId);
      const src = clip?.src.trim() ?? "";
      if (!src) return null;
      return {
        layerId: layer.id,
        src,
        volume: layer.volume,
      };
    })
    .filter((x): x is { layerId: string; src: string; volume: number } => x !== null);
  const posterSrcMerged = posterFromRow ?? posterSrc;
  return {
    videoSrc,
    ambientLayers,
    ...(previewStillSrc ? { previewStillSrc } : {}),
    ...(posterSrcMerged ? { posterSrc: posterSrcMerged } : {}),
  };
}
