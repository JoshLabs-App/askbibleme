import type { MusicShellPlaybackValue } from "@/components/music/MusicShellPlaybackContext";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { resolveHomeAlbumPlayIndex } from "@/lib/home/home-nature-album-press";
import {
  defaultMusicGainForAlbum,
  defaultRepeatModeForAlbum,
  findCompanionTrackIndexBySrc,
  inferTrackAlbumFromCompanionTrack,
  normalizeMusicAlbumLabel,
} from "@/lib/music/album-playback";
import { getShellDefaultAudioSrc } from "@/lib/music-companion/shell-default-audio-src";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";

/** 首页开播某专辑；金句仍在播时叠上去并压到人声 duck。 */
export function startHomeAlbumPlaybackWeb(
  playback: MusicShellPlaybackValue,
  album: string,
  opts: { duckForVerse: boolean },
): boolean {
  const store = playback.musicStore;
  if (!store) return false;

  const rawTracks = store.audioTracks.filter((t) => Boolean(t.src?.trim()));
  const pickTracks = rawTracks.map((t) => ({
    album: inferTrackAlbumFromCompanionTrack(t),
    localReady: true,
    src: t.src,
  }));

  const currentIdx = findCompanionTrackIndexBySrc(rawTracks, playback.effectiveSrc, shellPlaybackUrlsEqual);

  const startIndex = resolveHomeAlbumPlayIndex(pickTracks, album, currentIdx, (track) =>
    Boolean(track.src?.trim()),
  );
  if (startIndex == null) return false;

  const picked = rawTracks[startIndex];
  if (!picked?.src || normalizeMusicAlbumLabel(inferTrackAlbumFromCompanionTrack(picked)) !== normalizeMusicAlbumLabel(album)) {
    return false;
  }

  const repeatMode = defaultRepeatModeForAlbum(album);
  if (repeatMode) playback.setMusicAlbumRepeatModeOverride(repeatMode);

  const shellAudio = playback.getAudioElement();
  if (shellAudio) {
    const albumGain = defaultMusicGainForAlbum(album);
    shellAudio.volume = opts.duckForVerse ? Math.min(0.3, albumGain) : albumGain;
  }

  const src = picked.src.trim();
  const def = getShellDefaultAudioSrc(store)?.trim() ?? "";
  const nextSrc = def && shellPlaybackUrlsEqual(src, def) ? null : src;
  playback.setPlaybackSrc(nextSrc, { autoPlay: true });
  return true;
}

export function isShellMusicOnWeb(playback: MusicShellPlaybackValue): boolean {
  if (!playback.playing) return false;
  return !isCuvChapterAudioEffectiveSrc(playback.effectiveSrc);
}

export function resolveCurrentMusicAlbumWeb(playback: MusicShellPlaybackValue): string {
  const store = playback.musicStore;
  if (!store) return "";
  const tracks = store.audioTracks.filter((t) => Boolean(t.src?.trim()));
  const idx = findCompanionTrackIndexBySrc(tracks, playback.effectiveSrc, shellPlaybackUrlsEqual);
  if (idx < 0) return "";
  return normalizeMusicAlbumLabel(inferTrackAlbumFromCompanionTrack(tracks[idx]!));
}
