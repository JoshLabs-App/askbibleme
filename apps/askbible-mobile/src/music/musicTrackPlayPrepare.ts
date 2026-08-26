import { Platform } from "react-native";
import type { AVPlaybackSource } from "expo-av";
import type { MutableRefObject } from "react";
import { resolveAndroidMusicPadTrackUri } from "../media/androidMusicAssetPack";
import { resolveMusicTrackPlayback } from "../media/bundledMusicMedia";
import { ANDROID_MUSIC_PAD_TRACK_FILES } from "../media/generated/bundled-music-pad-manifest";
import { getAskBibleBaseUrl, isIosSimulator, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { findNextMusicTrackFallbackIndex, resolveMusicTrackAvSourceForPlay } from "./musicTrackPlayback";
import { pickRandomNextTrackIndexInAlbum } from "./musicCalmPlayback";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

export function normalizeMusicTrackIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function musicTrackSrcLooksRemote(track: PlaybackTrack): boolean {
  return (
    /^https?:\/\//i.test(track.src.trim()) || /^https?:\/\//i.test(track.catalogSrc.trim())
  );
}

export function shouldPrefetchMusicTrackOnIosSimulator(track: PlaybackTrack): boolean {
  return (
    Platform.OS === "ios" &&
    isIosSimulator() &&
    track.bundledModule == null &&
    (!track.localReady || musicTrackSrcLooksRemote(track)) &&
    !isMobileBundledOnly()
  );
}

type PrepareArgs = {
  tracks: PlaybackTrack[];
  index: number;
  generation: number;
  playTrackGenerationRef: MutableRefObject<number>;
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  failedTrackIdsRef: MutableRefObject<Set<string>>;
  playTrackAtRef: MutableRefObject<(index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>>;
  downloadMusicTrackAt: (index: number) => Promise<boolean>;
  cacheMusicTrackInBackground: (trackId: string) => void;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  setPlaying: (playing: boolean) => void;
  autoPlay?: boolean;
};

export type PreparedMusicTrack =
  | { ok: true; index: number; track: PlaybackTrack; avSource: AVPlaybackSource }
  | { ok: false; stale: true }
  | { ok: false; stale: false; aborted: true };

export async function prepareMusicTrackForPlay({
  tracks,
  index,
  generation,
  playTrackGenerationRef,
  storeRef,
  failedTrackIdsRef,
  playTrackAtRef,
  downloadMusicTrackAt,
  cacheMusicTrackInBackground,
  musicRepeatModeRef,
  setPlaying,
  autoPlay,
}: PrepareArgs): Promise<PreparedMusicTrack> {
  const i = normalizeMusicTrackIndex(index, tracks.length);
  const track = tracks[i]!;
  let playableTrack = track;

  if (
    Platform.OS === "android" &&
    !playableTrack.localReady &&
    ANDROID_MUSIC_PAD_TRACK_FILES[playableTrack.id]
  ) {
    const padUri = await resolveAndroidMusicPadTrackUri(playableTrack.id);
    if (generation !== playTrackGenerationRef.current) return { ok: false, stale: true };
    if (padUri) {
      playableTrack = {
        ...playableTrack,
        src: padUri,
        localReady: true,
      };
    }
  } else if (shouldPrefetchMusicTrackOnIosSimulator(playableTrack)) {
    const ok = await downloadMusicTrackAt(i);
    if (generation !== playTrackGenerationRef.current) return { ok: false, stale: true };
    if (ok) {
      const storeTrack = storeRef.current?.audioTracks.find((t) => t.id === track.id);
      const baseUrl = getAskBibleBaseUrl();
      const catalogSrc = storeTrack
        ? toAbsoluteUrl(baseUrl, storeTrack.src)
        : playableTrack.catalogSrc;
      const resolved = resolveMusicTrackPlayback(playableTrack.id, catalogSrc);
      playableTrack = {
        ...playableTrack,
        src: resolved.src,
        localReady: resolved.localReady,
        bundledModule: resolved.bundledModule,
      };
    }
  } else if (!playableTrack.localReady) {
    // R2 / 远程：先播 HTTPS，后台写入本地缓存。
    cacheMusicTrackInBackground(playableTrack.id);
  }

  if (musicRepeatModeRef.current === "all") {
    const nextIdx = pickRandomNextTrackIndexInAlbum(tracks, i, tracks.length);
    const nextTrack = tracks[nextIdx];
    if (nextTrack && nextTrack.id !== playableTrack.id && !nextTrack.localReady) {
      cacheMusicTrackInBackground(nextTrack.id);
    }
  }

  const avSource = await resolveMusicTrackAvSourceForPlay(playableTrack);
  if (avSource != null) {
    return { ok: true, index: i, track: playableTrack, avSource };
  }

  const missingId = track.id.trim();
  if (missingId) failedTrackIdsRef.current.add(missingId);
  const fallbackIndex = findNextMusicTrackFallbackIndex(tracks, i, failedTrackIdsRef.current, true);
  if (fallbackIndex != null) {
    void playTrackAtRef.current(fallbackIndex, { autoPlay });
    return { ok: false, stale: false, aborted: true };
  }
  if (failedTrackIdsRef.current.size >= tracks.length) {
    failedTrackIdsRef.current.clear();
  }
  setPlaying(false);
  return { ok: false, stale: false, aborted: true };
}

export { scheduleMusicTrackPlayFallback } from "./musicTrackPlayFallbackSchedule";
