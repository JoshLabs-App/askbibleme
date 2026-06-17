import type { MutableRefObject } from "react";
import type { MusicPlaybackMode } from "./musicPlaybackTypes";
import type { Audio } from "expo-av";

export function isScripturePlaybackStarted(args: {
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  soundRef: MutableRefObject<Audio.Sound | null>;
  scriptureSrcRef: MutableRefObject<string | null>;
}): boolean {
  return (
    args.playbackModeRef.current === "scripture" &&
    args.soundRef.current != null &&
    args.scriptureSrcRef.current != null
  );
}

export function applyScriptureSegmentBounds(args: {
  endAtSec?: number;
  startAtSec?: number;
  onSegmentEnd?: () => void;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
}) {
  const seekSec = args.startAtSec;
  const endAtSec = args.endAtSec;
  if (
    Number.isFinite(endAtSec) &&
    Number.isFinite(seekSec) &&
    (endAtSec ?? 0) > (seekSec ?? 0) + 0.12
  ) {
    args.scriptureStopAtSecRef.current = endAtSec ?? null;
    args.scriptureStopAtOnEndedRef.current = args.onSegmentEnd ?? null;
  } else {
    args.scriptureStopAtSecRef.current = null;
    args.scriptureStopAtOnEndedRef.current = null;
  }
}
