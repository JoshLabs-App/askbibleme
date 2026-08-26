import type { LocalizedField } from "@/lib/i18n/localized-text";
import type { AudioTrack } from "@/lib/music-companion/types";

export const MUSIC_ALBUMS = ["安静", "下午茶", "赞美诗", "钢琴", "睡眠", "专注工作"] as const;
export type MusicAlbumLabel = (typeof MUSIC_ALBUMS)[number] | string;
export const DEFAULT_MUSIC_ALBUM: MusicAlbumLabel = "安静";

export type MusicAlbumRepeatMode = "off" | "one" | "all";

function remarkText(remark?: LocalizedField): string {
  if (!remark) return "";
  if (typeof remark === "string") return remark;
  return remark["zh-CN"] ?? remark.en ?? "";
}

function firstTag(tags: string[]): string | null {
  for (const raw of tags) {
    const t = raw.trim();
    if (t) return t;
  }
  return null;
}

function albumFromRemark(remark: string): string | null {
  const trimmed = remark.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/专辑[:：]\s*([^\n;；。]+)/);
  if (m?.[1]) {
    const fromPrefix = m[1].trim();
    if (fromPrefix) return fromPrefix;
  }
  return null;
}

/** 与 App `normalizeMusicAlbumLabel` 对齐 */
export function normalizeMusicAlbumLabel(rawAlbum: string | null | undefined): string {
  const input = (rawAlbum || "").trim();
  if (!input) return DEFAULT_MUSIC_ALBUM;
  if (input === "工作" || input === "专注") return "专注工作";
  if (input === "放松") return "安静";
  if (input === "圣诗" || input === "赞美诗") return "赞美诗";
  return input;
}

/** 从曲库条目推断专辑（Web / 壳层共用） */
export function inferTrackAlbumFromCompanionTrack(track: AudioTrack): string {
  const tags = Array.isArray(track.tags) ? track.tags : [];
  for (const album of MUSIC_ALBUMS) {
    if (tags.includes(album)) return album;
  }
  if (tags.includes("工作")) return "专注工作";
  const customFromTag = firstTag(tags);
  if (customFromTag) return normalizeMusicAlbumLabel(customFromTag);
  const remarkRaw = remarkText(track.remark);
  if (remarkRaw.includes("专注工作") || remarkRaw.includes("工作")) return "专注工作";
  for (const album of MUSIC_ALBUMS) {
    if (remarkRaw.includes(album)) return album;
  }
  const customFromRemark = albumFromRemark(remarkRaw);
  if (customFromRemark) return normalizeMusicAlbumLabel(customFromRemark);
  return DEFAULT_MUSIC_ALBUM;
}

/** 安静 / 下午茶 / 钢琴 / 赞美诗：专辑内轮播；睡眠 / 专注：单曲循环 */
export function defaultRepeatModeForAlbum(album: string): MusicAlbumRepeatMode | null {
  const normalized = normalizeMusicAlbumLabel(album);
  if (normalized === "睡眠" || normalized === "专注工作") return "one";
  if (normalized === "安静" || normalized === "下午茶" || normalized === "钢琴" || normalized === "赞美诗")
    return "all";
  return null;
}

export function defaultMusicGainForAlbum(album: string): number {
  return normalizeMusicAlbumLabel(album) === "睡眠" ? 0.3 : 1;
}

export function albumUsesInAlbumLoop(album: string): boolean {
  return defaultRepeatModeForAlbum(album) === "all";
}

export function pickRandomNextIndex(current: number, total: number): number {
  if (total <= 1) return 0;
  let next = current;
  for (let i = 0; i < 8 && next === current; i += 1) {
    next = Math.floor(Math.random() * total);
  }
  if (next === current) return (current + 1) % total;
  return next;
}

export function pickRandomNextTrackIndexInAlbum(
  tracks: AudioTrack[],
  currentIndex: number,
  albumLabel?: string | null,
): number {
  if (tracks.length === 0) return 0;
  const current = tracks[currentIndex];
  const albumKey = normalizeMusicAlbumLabel(albumLabel ?? (current ? inferTrackAlbumFromCompanionTrack(current) : ""));
  const sameAlbumIndices = tracks
    .map((tr, idx) => ({ tr, idx }))
    .filter(({ tr }) => normalizeMusicAlbumLabel(inferTrackAlbumFromCompanionTrack(tr)) === albumKey)
    .map(({ idx }) => idx);
  if (sameAlbumIndices.length <= 1) return currentIndex >= 0 ? currentIndex : 0;
  const currentPos = sameAlbumIndices.findIndex((idx) => idx === currentIndex);
  if (currentPos < 0) return sameAlbumIndices[0] ?? currentIndex;
  let nextPos = currentPos;
  for (let i = 0; i < 8 && nextPos === currentPos; i += 1) {
    nextPos = Math.floor(Math.random() * sameAlbumIndices.length);
  }
  if (nextPos === currentPos) {
    nextPos = (currentPos + 1) % sameAlbumIndices.length;
  }
  return sameAlbumIndices[nextPos] ?? currentIndex;
}

export function findCompanionTrackIndexBySrc(
  tracks: AudioTrack[],
  src: string,
  urlsEqual: (a: string, b: string) => boolean,
): number {
  const want = src.trim();
  if (!want) return -1;
  return tracks.findIndex((t) => urlsEqual((t.src ?? "").trim(), want));
}
