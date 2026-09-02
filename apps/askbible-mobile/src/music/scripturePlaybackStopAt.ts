import type { MutableRefObject } from "react";
import type { AudioPlayer } from "expo-audio";
import type { LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import { logShellSoundError, safePauseSound } from "../audio/safeShellSound";

type Args = {
  status: LegacyPlaybackStatus & { isLoaded: true };
  soundRef: MutableRefObject<AudioPlayer | null>;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  setPlaying: (playing: boolean) => void;
};

/** @returns true when stop-at handling consumed this status tick */
export function handleScriptureStopAtStatus({
  status,
  soundRef,
  scriptureStopAtSecRef,
  scriptureStopAtOnEndedRef,
  setPlaying,
}: Args): boolean {
  const stopAtSec = scriptureStopAtSecRef.current;
  if (
    stopAtSec == null ||
    !Number.isFinite(stopAtSec) ||
    status.positionMillis < Math.max(0, Math.floor((stopAtSec - 0.06) * 1000))
  ) {
    return false;
  }

  scriptureStopAtSecRef.current = null;
  const active = soundRef.current;
  if (active) {
    void active
      .seekTo(Math.max(0, stopAtSec))
      .catch((err) => logShellSoundError("scripture-stopAt-seek", err));
    void safePauseSound(active).catch((err) => logShellSoundError("scripture-stopAt-pause", err));
  }
  setPlaying(false);
  const onSegmentEnd = scriptureStopAtOnEndedRef.current;
  scriptureStopAtOnEndedRef.current = null;
  if (onSegmentEnd) {
    setTimeout(() => onSegmentEnd(), 80);
  }
  return true;
}
