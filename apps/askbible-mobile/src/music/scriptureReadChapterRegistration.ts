import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import { navigateToReadChapterViaRegistry } from "../read/read-chapter-navigate-registry";
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
      // 这里是"音频先起播、章页刚 push 还没来得及在 ctx.readChapterRef 认领自己"那个
      // 窗口期兜底出来的 fallback handler（正常情况下章页会用自己的、带路由跳转的
      // handler）；仅推进音频不管路由会导致文字停在原章。有章页在监听就顺手把路由
      // 也带过去，没有（比如纯后台/锁屏续播）就维持原样只管音频。
      navigateToReadChapterViaRegistry(prev, "back");
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
      navigateToReadChapterViaRegistry(next, "forward");
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
