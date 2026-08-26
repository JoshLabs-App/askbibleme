import type { AVPlaybackStatus } from "expo-av";
import type { MutableRefObject } from "react";
import type { Audio } from "expo-av";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { restartCalmLoopWithCrossfade, resolveCalmLoopProfile } from "./musicCalmPlayback";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";

type CalmLoopStatusArgs = {
  status: AVPlaybackStatus & { isLoaded: true };
  track: PlaybackTrack;
  soundRef: MutableRefObject<Audio.Sound | null>;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  musicGainRef: MutableRefObject<number>;
  calmLoopTransitioningRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
};

/** @returns true when handler should return early (crossfade started). */
export function handleMusicCalmLoopTrimStatus(args: CalmLoopStatusArgs): boolean {
  const calmLoopProfile = resolveCalmLoopProfile(args.track);
  const shouldTrimTail =
    calmLoopProfile != null &&
    args.musicRepeatModeRef.current === "one" &&
    (args.status.durationMillis ?? 0) > calmLoopProfile.endTrimMs + 80;
  if (!shouldTrimTail || args.status.durationMillis == null || calmLoopProfile == null) {
    return false;
  }

  const trimAtMs = Math.max(0, args.status.durationMillis - calmLoopProfile.endTrimMs);
  const releaseAtMs = Math.max(0, trimAtMs - 420);
  if (!args.calmLoopTransitioningRef.current && args.status.positionMillis >= trimAtMs) {
    args.calmLoopTransitioningRef.current = true;
    const active = args.soundRef.current;
    if (active) {
      const fromVolume =
        typeof args.status.volume === "number" ? args.status.volume : args.musicGainRef.current;
      void (async () => {
        const ok = await restartCalmLoopWithCrossfade({
          sound: active,
          profile: calmLoopProfile,
          fromVolume,
          targetGain: args.musicGainRef.current,
        });
        args.calmLoopTransitioningRef.current = false;
        // 失败时保持「想播」，交给 interruption recovery，勿把会话钉死成暂停。
        if (ok) {
          setShellMusicWantPlaying(true);
          args.setPlaying(true);
        }
      })();
    }
    return true;
  }
  if (args.status.positionMillis < releaseAtMs) {
    args.calmLoopTransitioningRef.current = false;
  }
  return false;
}

export function musicDurationSecWithCalmTrim(
  track: PlaybackTrack,
  durationMillis: number | undefined,
  musicRepeatMode: MusicRepeatMode,
): number {
  const calmLoopProfile = resolveCalmLoopProfile(track);
  const shouldTrimTail =
    calmLoopProfile != null &&
    musicRepeatMode === "one" &&
    (durationMillis ?? 0) > calmLoopProfile.endTrimMs + 80;
  return durationMillis != null
    ? Math.max(0, (durationMillis - (shouldTrimTail ? calmLoopProfile!.endTrimMs : 0)) / 1000)
    : 0;
}
