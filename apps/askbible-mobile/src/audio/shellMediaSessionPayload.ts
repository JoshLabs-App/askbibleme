import type { MusicPlaybackMode } from "../music/musicPlaybackTypes";
import type { PlaybackTrack } from "../music/types";
import type { ReadChapterPlaybackRegistration } from "../music/scripturePlaybackTypes";
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { syncShellMediaSession, type ShellMediaSessionPayload } from "./shellMediaControls";

export type ShellMediaSessionArgs = {
  playing: boolean;
  playbackMode: MusicPlaybackMode;
  tracks: PlaybackTrack[];
  trackIndex: number;
  musicCurrentSec: number;
  musicDurationSec: number;
  scriptureCurrentSec: number;
  scriptureDurationSec: number;
  readChapter: ReadChapterPlaybackRegistration | null;
};

const liveArgsRef: { current: ShellMediaSessionArgs | null } = { current: null };

export function setShellMediaSessionLiveArgs(args: ShellMediaSessionArgs): void {
  liveArgsRef.current = args;
}

export function buildShellMediaSessionPayload(
  args: ShellMediaSessionArgs,
): ShellMediaSessionPayload | null {
  const {
    playing,
    playbackMode,
    tracks,
    trackIndex,
    musicCurrentSec,
    musicDurationSec,
    scriptureCurrentSec,
    scriptureDurationSec,
    readChapter,
  } = args;

  if (playbackMode === "music") {
    const track = tracks[trackIndex];
    if (!track) return null;
    return {
      title: track.title,
      artist: track.artist,
      album: track.album,
      artworkUri: track.artworkUri,
      durationSec: musicDurationSec > 0 ? musicDurationSec : track.durationSec ?? 0,
      positionSec: musicCurrentSec,
      playing,
    };
  }

  const chapter = readChapter ?? getActiveReadChapterPlayback();
  if (!chapter) return null;
  return {
    title: `${chapter.bookName} ${chapter.chapter}`,
    artist: "AskBible.me",
    album: chapter.translationId,
    durationSec: scriptureDurationSec,
    positionSec: scriptureCurrentSec,
    playing,
  };
}

export function refreshShellMediaSession(
  overrides?: Partial<
    Pick<
      ShellMediaSessionArgs,
      | "playing"
      | "musicCurrentSec"
      | "musicDurationSec"
      | "scriptureCurrentSec"
      | "scriptureDurationSec"
    >
  >,
): void {
  const base = liveArgsRef.current;
  if (!base) return;
  const merged = { ...base, ...overrides };
  const payload = buildShellMediaSessionPayload(merged);
  if (!payload) {
    syncShellMediaSession(null);
    return;
  }
  if (!payload.playing && payload.positionSec <= 0 && payload.durationSec <= 0) {
    syncShellMediaSession(null);
    return;
  }
  syncShellMediaSession(payload);
}
