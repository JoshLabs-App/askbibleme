import { setShellMusicNativePlaying } from "../audio/shellMusicNativePlaying";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { normalizeMusicAlbumLabel } from "../music/musicAlbumCatalog";
import {
  defaultMusicGainForAlbum,
  defaultRepeatModeForAlbum,
} from "../music/musicAlbumPlayback";
import type { MusicPlaybackContextValue } from "../music/musicPlaybackContextTypes";
import { isTrackPlayable } from "../music/trackArtwork";
import { resolveHomeAlbumPlayIndex } from "./homeNatureAlbumPress";

export type HomeAlbumPlaybackSlice = Pick<
  MusicPlaybackContextValue,
  "tracks" | "trackIndex" | "playTrackAt" | "setMusicGain" | "setMusicRepeatMode"
>;

/** 首页开播某专辑；金句仍在播时叠上去并压到人声 duck，不要拉回全音量。 */
export function startHomeAlbumPlayback(
  playback: HomeAlbumPlaybackSlice,
  album: string,
  opts: { duckForVerse: boolean },
): boolean {
  const { tracks, trackIndex, playTrackAt, setMusicGain, setMusicRepeatMode } = playback;
  const startIndex = resolveHomeAlbumPlayIndex(tracks, album, trackIndex, (track) =>
    isTrackPlayable(track as (typeof tracks)[number]),
  );
  if (startIndex == null) return false;
  const picked = tracks[startIndex];
  if (!picked || normalizeMusicAlbumLabel(picked.album) !== normalizeMusicAlbumLabel(album)) {
    return false;
  }
  const repeatMode = defaultRepeatModeForAlbum(album);
  if (repeatMode) setMusicRepeatMode(repeatMode);
  const albumGain = defaultMusicGainForAlbum(album);
  void setMusicGain(opts.duckForVerse ? Math.min(0.3, albumGain) : albumGain);
  // 必须先于金句 active 置位：iOS 金句要靠此标志选混音会话，否则会打断原生音乐。
  // 同步亮中间键 / 专辑黄标，勿等原生 Progress。
  setShellMusicWantPlaying(true);
  setShellMusicNativePlaying(true);
  void playTrackAt(startIndex, { autoPlay: true });
  return true;
}
