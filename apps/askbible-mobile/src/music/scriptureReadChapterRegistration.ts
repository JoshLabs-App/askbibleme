import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import {
  resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";

type ChapterArgs = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
};

export async function resolveReadChapterAudioRegistration(
  args: Omit<ReadChapterPlaybackRegistration, "chapterAudioSrc"> & {
    voiceId?: CuvChapterAudioVoiceId;
  },
): Promise<ReadChapterPlaybackRegistration> {
  let chapterAudioSrc: string | null = null;
  if (translationSupportsChapterAudio(args.translationId)) {
    const voiceId = args.voiceId ?? (await readCuvChapterAudioVoice());
    chapterAudioSrc = await resolveScripturePlayableSrcForChapter({
      translationId: args.translationId,
      bookName: args.bookName,
      bookId: args.bookId,
      chapter: args.chapter,
      voiceId,
    });
  }
  return { ...args, chapterAudioSrc };
}

export function buildReadChapterAdvanceHandlers(
  args: ChapterArgs,
  playScriptureChapter: (next: ChapterArgs & { translationId: string }) => Promise<boolean>,
  setPlaying: (playing: boolean) => void,
): Pick<
  ReadChapterPlaybackRegistration,
  "onAdvancePreviousChapter" | "onAdvanceNextChapter" | "onAdvanceNextInBook"
> {
  return {
    onAdvancePreviousChapter: () => {
      const { prev } = resolveReadChapterNeighbors(args.bookId, args.chapter);
      if (!prev) {
        setPlaying(false);
        return;
      }
      void playScriptureChapter({
        bookId: prev.bookId,
        chapter: prev.chapter,
        bookName: prev.bookName,
        translationId: args.translationId,
      });
    },
    onAdvanceNextChapter: () => {
      const { next } = resolveReadChapterNeighbors(args.bookId, args.chapter);
      if (!next) {
        setPlaying(false);
        return;
      }
      void playScriptureChapter({
        bookId: next.bookId,
        chapter: next.chapter,
        bookName: getScriptureBookDisplayName(next.bookId),
        translationId: args.translationId,
      });
    },
    onAdvanceNextInBook: () => {
      const next = getNextScriptureChapterInBook(args.bookId, args.chapter);
      if (!next) {
        setPlaying(false);
        return;
      }
      void playScriptureChapter({
        bookId: next.bookId,
        chapter: next.chapter,
        bookName: getScriptureBookDisplayName(next.bookId),
        translationId: args.translationId,
      });
    },
  };
}
