import type { MutableRefObject } from "react";
import {
  normalizeMusicResumeSec,
  readMusicPlaybackResume,
} from "./music-playback-prefs";
import type { PlaybackTrack } from "./types";

/** 手动点播放前：把上次暂停曲目/进度写回 refs，供 playTrackAt 续播。 */
export async function syncMusicResumeForManualPlay(args: {
  tracks: PlaybackTrack[];
  trackIndexRef: MutableRefObject<number>;
  resumeTrackIdRef: MutableRefObject<string | null>;
  resumePositionSecRef: MutableRefObject<number>;
}): Promise<number> {
  const { tracks, trackIndexRef, resumeTrackIdRef, resumePositionSecRef } = args;
  if (tracks.length === 0) return 0;

  const saved = await readMusicPlaybackResume();
  if (saved?.trackId) {
    const idx = tracks.findIndex((t) => t.id === saved.trackId);
    if (idx >= 0) {
      const track = tracks[idx]!;
      const sec = normalizeMusicResumeSec(saved.positionSec, track.durationSec);
      resumeTrackIdRef.current = track.id;
      resumePositionSecRef.current = sec;
      trackIndexRef.current = idx;
      return idx;
    }
  }

  if (
    resumeTrackIdRef.current &&
    resumePositionSecRef.current > 0
  ) {
    const idx = tracks.findIndex((t) => t.id === resumeTrackIdRef.current);
    if (idx >= 0) {
      trackIndexRef.current = idx;
      return idx;
    }
  }

  return Math.max(0, Math.min(trackIndexRef.current, tracks.length - 1));
}
