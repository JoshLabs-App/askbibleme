import type { AudioTrack, MusicCompanionStore } from "@/lib/music-companion/types";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";

export function findAudioTrackBySrc(store: MusicCompanionStore | null, src: string): AudioTrack | null {
  if (!store) return null;
  const u = src.trim();
  if (!u) return null;
  for (const t of store.audioTracks) {
    const ts = t.src?.trim() ?? "";
    if (!ts) continue;
    if (shellPlaybackUrlsEqual(ts, u)) return t;
  }
  return null;
}
