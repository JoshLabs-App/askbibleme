import {
  defaultRepeatModeForAlbum,
  findCompanionTrackIndexBySrc,
  inferTrackAlbumFromCompanionTrack,
  pickRandomNextTrackIndexInAlbum,
  type MusicAlbumRepeatMode,
} from "@/lib/music/album-playback";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";
import type { MusicCompanionStore } from "@/lib/music-companion/types";

export type ShellMusicEndedAction =
  | { kind: "loop_same"; src: string }
  | { kind: "advance"; src: string }
  | { kind: "stop" };

export function resolveShellMusicEndedAction(args: {
  store: MusicCompanionStore;
  currentSrc: string;
  repeatModeOverride?: MusicAlbumRepeatMode | null;
}): ShellMusicEndedAction {
  const cur = args.currentSrc.trim();
  if (!cur) return { kind: "stop" };

  const tracks = args.store.audioTracks.filter((t) => Boolean(t.src?.trim()));
  const idx = findCompanionTrackIndexBySrc(tracks, cur, shellPlaybackUrlsEqual);
  const track = idx >= 0 ? tracks[idx] : null;
  const album = track ? inferTrackAlbumFromCompanionTrack(track) : null;
  const repeatMode =
    args.repeatModeOverride ?? (album ? defaultRepeatModeForAlbum(album) : null) ?? "all";

  if (repeatMode === "one") {
    return { kind: "loop_same", src: cur };
  }
  if (repeatMode === "off") {
    return { kind: "stop" };
  }

  if (idx >= 0 && album) {
    const nextIdx = pickRandomNextTrackIndexInAlbum(tracks, idx, album);
    const nextSrc = tracks[nextIdx]?.src?.trim() ?? "";
    if (nextSrc) return { kind: "advance", src: nextSrc };
  }

  return { kind: "stop" };
}

export function pickRandomShellAudioTrackSrcInAlbum(
  store: MusicCompanionStore,
  exceptUrl: string | null | undefined,
): string | null {
  const tracks = store.audioTracks.filter((t) => Boolean(t.src?.trim()));
  if (tracks.length === 0) return null;
  const ex = (exceptUrl ?? "").trim();
  const idx = ex ? findCompanionTrackIndexBySrc(tracks, ex, shellPlaybackUrlsEqual) : -1;
  if (idx < 0) return tracks[0]?.src?.trim() ?? null;
  const album = inferTrackAlbumFromCompanionTrack(tracks[idx]!);
  const nextIdx = pickRandomNextTrackIndexInAlbum(tracks, idx, album);
  return tracks[nextIdx]?.src?.trim() ?? null;
}
