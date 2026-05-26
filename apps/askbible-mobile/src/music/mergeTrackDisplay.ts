import type { AudioTrack, MusicCompanionStore } from "./types";

const LEGACY_NUMERIC_TITLE_RE = /^\d{1,2}$/;
const AUTO_MUSIC_TITLE_RE = /^音乐 \d{4}-\d{2}-\d{2} · \d{2}$/;

function primaryTrackTitle(title: AudioTrack["title"]): string {
  if (typeof title === "string") return title.trim();
  return (title["zh-CN"] || title.en || "").trim();
}

function isStaleMusicTrackDisplayTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (LEGACY_NUMERIC_TITLE_RE.test(t)) return true;
  if (AUTO_MUSIC_TITLE_RE.test(t)) return true;
  return false;
}

/** 与网站 API 相同：线上旧编号曲名用 App 内置曲库覆盖 */
export function mergeMusicCompanionTrackDisplay(
  runtime: MusicCompanionStore,
  shipped: MusicCompanionStore,
): MusicCompanionStore {
  const shippedById = new Map(shipped.audioTracks.map((t) => [t.id, t]));
  return {
    ...runtime,
    audioTracks: runtime.audioTracks.map((t) => {
      const canon = shippedById.get(t.id);
      if (!canon) return t;
      if (!isStaleMusicTrackDisplayTitle(primaryTrackTitle(t.title))) return t;
      return {
        ...t,
        title: canon.title,
        artist: canon.artist ?? t.artist,
        analysisSrc: t.analysisSrc ?? canon.analysisSrc,
      };
    }),
  };
}
