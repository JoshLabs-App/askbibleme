import type { PlaybackTrack } from "./types";

const CALM_ALBUMS = new Set(["专注工作", "睡眠"]);
const CALM_TRACK_END_TRIM_MS = 240;
const CALM_LOOP_CROSSFADE_MS = 520;
const CALM_LOOP_RESTART_OFFSET_MS = 120;

export type CalmLoopProfile = {
  endTrimMs: number;
  crossfadeMs: number;
  restartOffsetMs: number;
  startOffsetMs?: number;
};

const CALM_TRACK_LOOP_PROFILE_BY_ID: Record<string, Partial<CalmLoopProfile>> = {
  "track-mpkn1s6ax3sk": {
    startOffsetMs: 380,
    restartOffsetMs: 380,
  },
};

export function shouldUseCalmAlbumFade(track: PlaybackTrack | null | undefined): boolean {
  return CALM_ALBUMS.has((track?.album || "").trim());
}

export function resolveCalmLoopProfile(track: PlaybackTrack | null | undefined): CalmLoopProfile | null {
  if (!shouldUseCalmAlbumFade(track)) return null;
  const base: CalmLoopProfile = {
    endTrimMs: CALM_TRACK_END_TRIM_MS,
    crossfadeMs: CALM_LOOP_CROSSFADE_MS,
    restartOffsetMs: CALM_LOOP_RESTART_OFFSET_MS,
    startOffsetMs: 0,
  };
  const byId = track?.id ? CALM_TRACK_LOOP_PROFILE_BY_ID[track.id] : undefined;
  return byId ? { ...base, ...byId } : base;
}
