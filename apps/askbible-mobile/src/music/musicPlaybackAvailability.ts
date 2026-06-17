import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { isTrackPlayable } from "./trackArtwork";
import type { PlaybackTrack } from "./types";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";

export function resolveReadChapterAudioAvailable(
  readChapterRef: { current: ReadChapterPlaybackRegistration | null },
  readChapter: ReadChapterPlaybackRegistration | null,
): boolean {
  const activeReadForAudio = getActiveReadChapterPlayback() ?? readChapterRef.current ?? readChapter;
  return Boolean(activeReadForAudio && translationSupportsChapterAudio(activeReadForAudio.translationId));
}

export function resolveCanTogglePlayback(tracks: PlaybackTrack[], readChapterSupportsAudio: boolean): boolean {
  const hasPlayableMusic = tracks.some((t) => isTrackPlayable(t));
  return readChapterSupportsAudio || hasPlayableMusic || (!isMobileBundledOnly() && tracks.length > 0);
}
