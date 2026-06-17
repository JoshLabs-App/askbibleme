import { useCallback, useEffect, useMemo, useState } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { DEFAULT_MUSIC_ALBUM, normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import { buildMusicHomeAlbumCounts, buildMusicHomeAlbumNames } from "./musicHomeAlbumMeta";
import {
  buildFilteredTrackIndices,
  defaultMusicGainForAlbum,
  defaultRepeatModeForAlbum,
  pickAlbumStartTrackIndex,
  resolveSleepTimerOnAlbumSwitch,
} from "./musicAlbumPlayback";
import type { ShellSleepTimerMinutes, MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  trackIndex: number;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  playTrackAt: (index: number) => Promise<void>;
  setMusicGain: (gain: number) => Promise<void>;
  setMusicRepeatMode: (mode: MusicRepeatMode) => void;
  setSleepTimerMinutes: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function useMusicHomeAlbum({
  tracks,
  trackIndex,
  sleepTimerMinutes,
  playTrackAt,
  setMusicGain,
  setMusicRepeatMode,
  setSleepTimerMinutes,
}: Args) {
  const [album, setAlbum] = useState<string>(DEFAULT_MUSIC_ALBUM);
  const offlineMusicOnly = isMobileBundledOnly();

  const filteredTrackIndices = useMemo(
    () => buildFilteredTrackIndices(tracks, album, offlineMusicOnly),
    [album, offlineMusicOnly, tracks],
  );

  const albumNames = useMemo(() => buildMusicHomeAlbumNames(tracks), [tracks]);
  const albumCounts = useMemo(() => buildMusicHomeAlbumCounts(tracks), [tracks]);

  useEffect(() => {
    if ((albumCounts[album] ?? 0) > 0) return;
    const next = albumNames.find((name) => (albumCounts[name] ?? 0) > 0) ?? DEFAULT_MUSIC_ALBUM;
    if (next !== album) setAlbum(next);
  }, [album, albumCounts, albumNames]);

  useEffect(() => {
    if (!offlineMusicOnly || filteredTrackIndices.length > 0) return;
    const nextAlbum = albumNames.find((name) =>
      tracks.some((tr) => normalizeMusicAlbumLabel(tr.album) === name && tr.localReady),
    );
    if (nextAlbum && nextAlbum !== album) setAlbum(nextAlbum);
  }, [album, albumNames, filteredTrackIndices.length, offlineMusicOnly, tracks]);

  useEffect(() => {
    void setMusicGain(defaultMusicGainForAlbum(album));
  }, [album, setMusicGain]);

  useEffect(() => {
    const repeatMode = defaultRepeatModeForAlbum(album);
    if (repeatMode) setMusicRepeatMode(repeatMode);
  }, [album, setMusicRepeatMode]);

  const selectAlbum = useCallback(
    (nextAlbum: string) => {
      if (nextAlbum === album) return;
      setAlbum(nextAlbum);
      const repeatMode = defaultRepeatModeForAlbum(nextAlbum);
      if (repeatMode) setMusicRepeatMode(repeatMode);
      const nextSleepTimer = resolveSleepTimerOnAlbumSwitch(nextAlbum, sleepTimerMinutes);
      if (nextSleepTimer != null) setSleepTimerMinutes(nextSleepTimer);
      const startIndex = pickAlbumStartTrackIndex(tracks, nextAlbum, trackIndex);
      void setMusicGain(defaultMusicGainForAlbum(nextAlbum));
      if (startIndex != null) void playTrackAt(startIndex);
    },
    [
      album,
      playTrackAt,
      setMusicGain,
      setMusicRepeatMode,
      setSleepTimerMinutes,
      sleepTimerMinutes,
      trackIndex,
      tracks,
    ],
  );

  const currentFilteredIndex = useMemo(
    () => filteredTrackIndices.findIndex((idx) => idx === trackIndex),
    [filteredTrackIndices, trackIndex],
  );

  return {
    album,
    filteredTrackIndices,
    albumNames,
    albumCounts,
    selectAlbum,
    currentFilteredIndex,
    offlineMusicOnly,
  };
}
