import type { NatureSettingsV2, NatureVideoEntry } from "./types";
import { resolveNatureVideoSrcForEntry } from "./resolve-nature-playback";

/** `/scenes` 背景影片 id：显式配置 → 首页当前 → 列表首条 */
export function resolveScenesPageVideoId(s: NatureSettingsV2): string {
  const explicit = s.scenesPageVideoId?.trim() ?? "";
  if (explicit && s.videos.some((v) => v.id === explicit)) return explicit;
  const active = s.activeVideoId.trim();
  if (active && s.videos.some((v) => v.id === active)) return active;
  return s.videos[0]?.id ?? "";
}

export function resolveScenesPageVideoEntry(s: NatureSettingsV2): NatureVideoEntry | undefined {
  const id = resolveScenesPageVideoId(s);
  if (!id) return undefined;
  return s.videos.find((v) => v.id === id);
}

export function resolveScenesPagePlayback(
  s: NatureSettingsV2,
  opts?: { prefer1080?: boolean },
): { videoSrc: string; posterSrc?: string } {
  const row = resolveScenesPageVideoEntry(s);
  if (!row) return { videoSrc: "" };
  const videoSrc = resolveNatureVideoSrcForEntry(row, Boolean(opts?.prefer1080));
  const rowPreview = row.previewFrameSrc?.trim();
  const rowThumb = row.thumbSrc?.trim();
  const posterSrc =
    (rowPreview && rowPreview.length > 0 ? rowPreview : undefined) ??
    (rowThumb && rowThumb.length > 0 ? rowThumb : undefined);
  return { videoSrc, ...(posterSrc ? { posterSrc } : {}) };
}
