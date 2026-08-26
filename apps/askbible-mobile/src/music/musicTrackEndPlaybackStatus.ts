import type { AVPlaybackStatus } from "expo-av";
import type { MutableRefObject } from "react";
import type { Audio } from "expo-av";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { logShellSoundError, safePlaySound } from "../audio/safeShellSound";
import {
  pickRandomNextTrackIndexInAlbum,
  resolveCalmLoopProfile,
  restartCalmLoopWithCrossfade,
  shouldAdvanceMusicOnEnd,
} from "./musicCalmPlayback";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";

type TrackEndArgs = {
  status: AVPlaybackStatus & { isLoaded: true };
  track: PlaybackTrack;
  tracks: PlaybackTrack[];
  soundRef: MutableRefObject<Audio.Sound | null>;
  musicMaxProgressMsRef: MutableRefObject<number>;
  musicSoundActivatedAtRef: MutableRefObject<number>;
  calmLoopTransitioningRef: MutableRefObject<boolean>;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  musicGainRef: MutableRefObject<number>;
  trackIndexRef: MutableRefObject<number>;
  playTrackAtRef: MutableRefObject<(index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
};

export function handleMusicTrackDidJustFinish(args: TrackEndArgs): void {
  if (
    !shouldAdvanceMusicOnEnd(
      args.musicMaxProgressMsRef.current,
      args.status.durationMillis,
      args.musicSoundActivatedAtRef.current,
    )
  ) {
    args.syncPlayingState(false);
    setShellMusicWantPlaying(false);
    return;
  }

  if (args.musicRepeatModeRef.current === "one") {
    setShellMusicWantPlaying(true);
    const active = args.soundRef.current;
    if (active) {
      const calmLoopProfile = resolveCalmLoopProfile(args.track);
      if (calmLoopProfile != null) {
        if (args.calmLoopTransitioningRef.current) return;
        const fromVolume =
          typeof args.status.volume === "number" ? args.status.volume : args.musicGainRef.current;
        args.calmLoopTransitioningRef.current = true;
        void restartCalmLoopWithCrossfade({
          sound: active,
          profile: calmLoopProfile,
          fromVolume,
          targetGain: args.musicGainRef.current,
          logTag: "music-repeat-one-calm",
        })
          .then((ok) => {
            args.calmLoopTransitioningRef.current = false;
            args.setPlaying(ok);
          })
          .catch((err) => {
            args.calmLoopTransitioningRef.current = false;
            logShellSoundError("music-repeat-one-calm", err);
          });
      } else {
        void active
          .setPositionAsync(0)
          .then(() => safePlaySound(active))
          .catch((err) => logShellSoundError("music-repeat-one", err));
      }
    }
    args.setPlaying(true);
    return;
  }

  if (args.musicRepeatModeRef.current === "all") {
    setShellMusicWantPlaying(true);
    const next = pickRandomNextTrackIndexInAlbum(
      args.tracks,
      args.trackIndexRef.current,
      args.tracks.length,
    );
    void args.playTrackAtRef.current(next);
    return;
  }

  setShellMusicWantPlaying(false);
  args.setPlaying(false);
}
