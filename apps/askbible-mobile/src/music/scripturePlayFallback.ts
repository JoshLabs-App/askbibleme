import type { MutableRefObject } from "react";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { resolveChapterAudioExternalUrl } from "../bible/chapter-audio-sources";
import { scriptureAudioUrlsEqual } from "../bible/cuv-chapter-audio";
import { resolveScripturePlayableSrcForChapter } from "../bible/read-chapter-audio";
import { isSameScriptureChapter } from "./scripturePlaybackExclusive";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";

export async function resolveScriptureFallbackSrc(
  reg: ReadChapterPlaybackRegistration,
  preferredSrc: string,
): Promise<string | null> {
  const voiceId = await readCuvChapterAudioVoice();
  const externalSrc = resolveChapterAudioExternalUrl({
    translationId: reg.translationId,
    bookId: reg.bookId,
    chapter: reg.chapter,
    voiceId,
  });
  const fallbackSrc =
    externalSrc && !scriptureAudioUrlsEqual(externalSrc, preferredSrc)
      ? externalSrc
      : await resolveScripturePlayableSrcForChapter({
          translationId: reg.translationId,
          bookId: reg.bookId,
          chapter: reg.chapter,
          bookName: reg.bookName,
          voiceId,
          cachedSrc: null,
        });
  if (!fallbackSrc || scriptureAudioUrlsEqual(fallbackSrc, preferredSrc)) {
    return null;
  }
  return fallbackSrc;
}

export async function tryPlayScriptureWithFallback(args: {
  reg: ReadChapterPlaybackRegistration;
  preferredSrc: string;
  playScripture: (src: string) => Promise<void>;
  patchReadChapterSrc: (src: string) => void;
  isStarted: () => boolean;
  isBusy?: () => boolean;
  /** 若 shell 已在播同一章，则跳过（planFlow 换章时必须能强制开播）。 */
  playingReg?: ReadChapterPlaybackRegistration | null;
}): Promise<void> {
  if (
    args.isBusy?.() &&
    args.isStarted() &&
    args.playingReg &&
    isSameScriptureChapter(args.playingReg, args.reg)
  ) {
    return;
  }
  if (__DEV__) {
    console.warn("[scripture-audio] try primary src", args.preferredSrc);
  }
  await args.playScripture(args.preferredSrc);
  if (args.isStarted()) return;

  const fallbackSrc = await resolveScriptureFallbackSrc(args.reg, args.preferredSrc);
  if (!fallbackSrc) {
    if (__DEV__) {
      console.warn(
        "[scripture-audio] no fallback src",
        args.reg.bookId,
        args.reg.chapter,
        args.reg.translationId,
      );
    }
    return;
  }

  if (__DEV__) {
    console.warn("[scripture-audio] fallback src", fallbackSrc);
  }
  args.patchReadChapterSrc(fallbackSrc);
  await args.playScripture(fallbackSrc);
}

export function patchReadChapterSrc(args: {
  src: string;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
}) {
  const rc = args.readChapterRef.current;
  if (!rc || !args.src.trim()) return;
  if (rc.chapterAudioSrc?.trim() === args.src.trim()) return;
  const next = { ...rc, chapterAudioSrc: args.src.trim() };
  args.readChapterRef.current = next;
  args.setReadChapter(next);
}
