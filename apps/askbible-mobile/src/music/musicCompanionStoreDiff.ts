import type { MusicCompanionStore } from "./types";

function normalizedTrackTitle(track: MusicCompanionStore["audioTracks"][number]): string {
  if (typeof track.title === "string") return track.title.trim();
  return (track.title["zh-CN"] || track.title.en || "").trim();
}

function storeSignature(store: MusicCompanionStore): string {
  const rows = store.audioTracks.map((track) => {
    const tags = Array.isArray(track.tags) ? track.tags.join(",") : "";
    return [
      track.id.trim(),
      (track.src || "").trim(),
      normalizedTrackTitle(track),
      tags.trim(),
      typeof track.remark === "string" ? track.remark.trim() : "",
    ].join("|");
  });
  return rows.sort().join(";");
}

export function isMusicCompanionStoreDifferent(
  nextStore: MusicCompanionStore | null | undefined,
  currentStore: MusicCompanionStore | null | undefined,
): boolean {
  if (!nextStore || !currentStore) return false;
  return storeSignature(nextStore) !== storeSignature(currentStore);
}
