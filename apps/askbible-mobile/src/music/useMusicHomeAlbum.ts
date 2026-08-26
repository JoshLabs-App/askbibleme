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
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { isTrackPlayable } from "./trackArtwork";
import type { ShellSleepTimerMinutes, MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";
import type { PlayTrackAtOptions } from "./musicPlaybackContextTypes";

type Args = {
  tracks: PlaybackTrack[];
  trackIndex: number;
  /** 音乐是否正在播放；切专辑要把播放状态一起带过去。 */
  playing: boolean;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  playTrackAt: (index: number, opts?: PlayTrackAtOptions) => Promise<boolean>;
  downloadMusicTrackAt: (index: number) => Promise<boolean>;
  setMusicGain: (gain: number) => Promise<void>;
  setMusicRepeatMode: (mode: MusicRepeatMode) => void;
  setSleepTimerMinutes: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function useMusicHomeAlbum({
  tracks,
  trackIndex,
  playing,
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
  const albumCounts = useMemo(() => {
    // 角标：本机就绪 + R2 可点播都计入（TEMP），与列表一致。
    if (!offlineMusicOnly) return buildMusicHomeAlbumCounts(tracks);
    const counts: Record<string, number> = {};
    for (const tr of tracks) {
      if (!isTrackPlayable(tr)) continue;
      const label = normalizeMusicAlbumLabel(tr.album);
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [offlineMusicOnly, tracks]);

  // 仅在当前专辑在目录里完全不存在时回落；用户点开 0 首本地专辑时不要强制弹回。
  useEffect(() => {
    if (albumNames.includes(album)) return;
    const next =
      albumNames.find((name) => (albumCounts[name] ?? 0) > 0) ??
      albumNames[0] ??
      DEFAULT_MUSIC_ALBUM;
    if (next !== album) setAlbum(next);
  }, [album, albumCounts, albumNames]);

  useEffect(() => {
    void setMusicGain(defaultMusicGainForAlbum(album));
  }, [album, setMusicGain]);

  useEffect(() => {
    const repeatMode = defaultRepeatModeForAlbum(album);
    if (repeatMode) setMusicRepeatMode(repeatMode);
  }, [album, setMusicRepeatMode]);

  const currentTrackAlbum = normalizeMusicAlbumLabel(tracks[trackIndex]?.album);
  useEffect(() => {
    if (!currentTrackAlbum || !albumNames.includes(currentTrackAlbum)) return;
    setAlbum(currentTrackAlbum);
    // 只跟当前曲目专辑走。albumNames 身份变化不要把刚点的圣诗弹回去。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- albumNames 仅作存在性检查
  }, [currentTrackAlbum]);

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
      if (startIndex != null) {
        // 正在播放时切专辑要继续播，否则旧曲还响着、界面却停在暂停态。
        if (playing) setShellMusicWantPlaying(true);
        // 先切到该专辑本地首曲；R2 由 playTrackAt 后台缓存，勿先 download 卡住转圈。
        void playTrackAt(startIndex, { autoPlay: playing });
      }
    },
    [
      album,
      playing,
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
