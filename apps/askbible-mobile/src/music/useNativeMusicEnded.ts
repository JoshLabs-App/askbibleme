import { useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { reshuffleShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { setShellMusicPlayableAssetUri } from "../audio/shellMusicPlayableAssetUri";
import { patchShellMediaSessionLiveArgs } from "../audio/shellMediaSessionPayload";
import type { MutableRefObject } from "react";
import {
  buildMusicNativeNextUris,
  findTrackIndexByResolvedUri,
} from "./musicNativeNextQueue";
import type { PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  trackIndexRef: MutableRefObject<number>;
  playingStateRef: MutableRefObject<boolean>;
  setTrackIndex: (index: number) => void;
  setMusicCurrentSec: (sec: number) => void;
  setPlaying: (playing: boolean) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
};

type NativeEndedPayload = {
  nativeChained?: boolean;
  assetUri?: string;
  awaitingJs?: boolean;
};

async function refillMusicNativeNextQueue(args: {
  tracks: PlaybackTrack[];
  currentIndex: number;
  currentAssetUri: string | null;
  track: PlaybackTrack;
}): Promise<void> {
  if (!getShellMusicWantPlaying()) return;
  const nextAssetUris = await buildMusicNativeNextUris({
    tracks: args.tracks,
    startIndex: args.currentIndex,
  });
  const artworkUri = await reshuffleShellMediaSceneArtwork();
  syncShellMediaSessionExplicit({
    title: args.track.title,
    artist: args.track.artist,
    album: args.track.album,
    assetUri: args.currentAssetUri,
    artworkUri,
    durationSec: args.track.durationSec ?? 0,
    positionSec: 0,
    playing: true,
    kind: "music",
    nextAssetUri: nextAssetUris[0] ?? null,
    nextNextAssetUri: nextAssetUris[1] ?? null,
    nextAssetUris,
  });
}

/** 原生音乐曲终：接播下一首并补队列（关屏不依赖 JS RemoteNext）。 */
export function useNativeMusicEnded(args: Args): void {
  useEffect(() => {
    const onEnded = (raw?: unknown) => {
      if (!getShellMusicWantPlaying() && !args.playingStateRef.current) return;
      const payload =
        raw && typeof raw === "object" ? (raw as NativeEndedPayload) : ({} as NativeEndedPayload);
      if (payload.awaitingJs) {
        // 队列空：由 playNext 补；此处不重复切曲。
        return;
      }
      if (!payload.nativeChained || !payload.assetUri) return;

      const idx = findTrackIndexByResolvedUri(args.tracks, payload.assetUri);
      const track = idx >= 0 ? args.tracks[idx] : null;
      if (track) {
        args.trackIndexRef.current = idx;
        args.setTrackIndex(idx);
        args.setMusicCurrentSec(0);
        args.playingStateRef.current = true;
        args.setPlaying(true);
        setShellMusicPlayableAssetUri(payload.assetUri);
        void args.persistMusicResume(track.id, 0);
        patchShellMediaSessionLiveArgs({
          tracks: args.tracks,
          playbackMode: "music",
          trackIndex: idx,
          musicCurrentSec: 0,
          playing: true,
        });
        void refillMusicNativeNextQueue({
          tracks: args.tracks,
          currentIndex: idx,
          currentAssetUri: payload.assetUri,
          track,
        });
      }
    };
    const sub = DeviceEventEmitter.addListener("ShellMediaNativeMusicEnded", onEnded);
    return () => sub.remove();
  }, [args]);
}
