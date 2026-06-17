import type { Audio } from "expo-av";
import type { AVPlaybackStatus } from "expo-av";
import type { MutableRefObject } from "react";
import {
  markMusicPlaybackActivated,
  writeCachedMusicCompanionStore,
} from "./fetchMusicCompanion";
import {
  durationSecFromLoadedStatus,
  isMusicNearEnd,
  normalizeMusicResumeSec,
} from "./music-playback-prefs";
import { resolveCalmLoopProfile } from "./musicCalmPlayback";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

type ApplyStartArgs = {
  sound: Audio.Sound;
  track: PlaybackTrack;
  resumeTrackIdRef: MutableRefObject<string | null>;
  resumePositionSecRef: MutableRefObject<number>;
  lastMusicProgressSecRef: MutableRefObject<number>;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  loadedStatus: AVPlaybackStatus | null;
};

export async function applyMusicTrackStartPosition({
  sound,
  track,
  resumeTrackIdRef,
  resumePositionSecRef,
  lastMusicProgressSecRef,
  setMusicCurrentSec,
  setMusicDurationSec,
  persistMusicResume,
  loadedStatus,
}: ApplyStartArgs): Promise<void> {
  const resumeSecForTrackRaw =
    resumeTrackIdRef.current === track.id ? Math.max(0, resumePositionSecRef.current) : 0;
  const resumeSecForTrack = normalizeMusicResumeSec(resumeSecForTrackRaw, track.durationSec);
  const calmLoopProfileForTrack = resolveCalmLoopProfile(track);

  const loadedDurationSec = durationSecFromLoadedStatus(
    track.durationSec,
    loadedStatus?.isLoaded ? loadedStatus.durationMillis : undefined,
  );
  const loadedPosMs =
    loadedStatus?.isLoaded && typeof loadedStatus.positionMillis === "number"
      ? loadedStatus.positionMillis
      : 0;
  const effectiveResumeSec = normalizeMusicResumeSec(
    isMusicNearEnd(loadedPosMs / 1000, loadedDurationSec) ? 0 : resumeSecForTrack,
    loadedDurationSec,
  );
  if (loadedDurationSec && loadedDurationSec > 0) {
    setMusicDurationSec(loadedDurationSec);
  }
  if (effectiveResumeSec > 0) {
    await sound.setPositionAsync(Math.floor(effectiveResumeSec * 1000));
    lastMusicProgressSecRef.current = effectiveResumeSec;
    setMusicCurrentSec(effectiveResumeSec);
  } else if ((calmLoopProfileForTrack?.startOffsetMs ?? 0) > 0) {
    const startOffsetMs = Math.max(0, Math.floor(calmLoopProfileForTrack?.startOffsetMs ?? 0));
    await sound.setPositionAsync(startOffsetMs);
    lastMusicProgressSecRef.current = startOffsetMs / 1000;
    setMusicCurrentSec(startOffsetMs / 1000);
  } else if (loadedPosMs > 400) {
    await sound.setPositionAsync(0);
    lastMusicProgressSecRef.current = 0;
    setMusicCurrentSec(0);
  } else {
    lastMusicProgressSecRef.current = -1;
    setMusicCurrentSec(0);
  }
  if (resumeSecForTrackRaw !== effectiveResumeSec) {
    resumePositionSecRef.current = effectiveResumeSec;
    void persistMusicResume(track.id, effectiveResumeSec);
  }
}

export async function persistMusicStoreSnapshot(storeRef: MutableRefObject<MusicCompanionStore | null>) {
  await markMusicPlaybackActivated();
  const snapshot = storeRef.current;
  if (snapshot?.audioTracks?.length) {
    await writeCachedMusicCompanionStore(snapshot);
  }
}
