import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import { isTrackPlayable } from "./trackArtwork";
import type { PlaybackTrack } from "./types";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";

export function resolveReadChapterAudioAvailable(
  readChapterRef: { current: ReadChapterPlaybackRegistration | null },
  readChapter: ReadChapterPlaybackRegistration | null,
  readHomeTodayAudioReady = false,
): boolean {
  const activeReadForAudio = getActiveReadChapterPlayback() ?? readChapterRef.current ?? readChapter;
  if (activeReadForAudio && translationSupportsChapterAudio(activeReadForAudio.translationId)) {
    return true;
  }
  return readHomeTodayAudioReady;
}

export function resolveCanTogglePlayback(tracks: PlaybackTrack[], readChapterSupportsAudio: boolean): boolean {
  const hasPlayableMusic = tracks.some((t) => isTrackPlayable(t));
  return readChapterSupportsAudio || hasPlayableMusic || (!isMobileBundledOnly() && tracks.length > 0);
}
