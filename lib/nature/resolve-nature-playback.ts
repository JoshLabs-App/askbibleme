import type { NatureSettingsV2, NatureVideoEntry } from "./types";
import {
  NATURE_VIDEO_AMBIENT_AUDIO_ENABLED,
  buildNatureAmbientPlaybackLayers,
} from "./nature-video-ambient-audio";

/** 按用户「高清」偏好解析单条影片的实际播放地址 */
export function resolveNatureVideoSrcForEntry(
  entry: NatureVideoEntry | undefined,
  prefer1080: boolean,
): string {
  if (!entry) return "";
  const base = entry.src.trim();
  const hi = entry.src1080?.trim() ?? "";
  if (prefer1080 && hi) return hi;
  return base;
}

export function resolveNaturePlayback(
  s: NatureSettingsV2,
  opts?: { prefer1080?: boolean },
): {
  videoSrc: string;
  posterSrc?: string;
  /** 预览条静态图：首帧 JPEG 优先，否则正方形 thumb；二者皆无时预览条回退为内联视频 */
  previewStillSrc?: string;
  /** 环境声层；`NATURE_VIDEO_AMBIENT_AUDIO_ENABLED` 为 false 时恒为空（后台 mix 仍保留在 JSON）。 */
  ambientLayers: { layerId: string; src: string; volume: number }[];
} {
  const prefer1080 = Boolean(opts?.prefer1080);
  const posterSrc = s.posterSrc?.trim();
  if (!s.videos.length) {
    return { videoSrc: "", ambientLayers: [], ...(posterSrc ? { posterSrc } : {}) };
  }
  const want = s.activeVideoId.trim();
  const hit = want ? s.videos.find((v) => v.id === want) : undefined;
  const row = hit ?? s.videos[0];
  const videoSrc = resolveNatureVideoSrcForEntry(row, prefer1080);
  const rowThumb = row?.thumbSrc?.trim();
  const rowPreview = row?.previewFrameSrc?.trim();
  const posterFromRow =
    (rowPreview && rowPreview.length > 0 ? rowPreview : undefined) ??
    (rowThumb && rowThumb.length > 0 ? rowThumb : undefined);
  const previewStillSrc = posterFromRow;
  const ambientLayers = NATURE_VIDEO_AMBIENT_AUDIO_ENABLED
    ? buildNatureAmbientPlaybackLayers(s.ambientClips, row?.mix)
    : [];
  const posterSrcMerged = posterFromRow ?? posterSrc;
  return {
    videoSrc,
    ambientLayers,
    ...(previewStillSrc ? { previewStillSrc } : {}),
    ...(posterSrcMerged ? { posterSrc: posterSrcMerged } : {}),
  };
}
