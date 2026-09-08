import {
  getNextScriptureChapter,
  getNextScriptureChapterInBook,
} from "@/lib/bible/next-scripture-chapter";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { resolveScripturePlayableSrcForChapter } from "../bible/read-chapter-audio";
import { resolveIosNativeScriptureAssetUri } from "./resolveIosNativeScriptureAssetUri";
import { SCRIPTURE_NATIVE_NEXT_PREFETCH, scriptureChapterPool } from "./scripture-chapter-pool";
import { rememberScriptureQueueChapter } from "./scriptureQueueChapterMap";
import type { ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";

type ChapterRef = { bookId: string; chapter: number };

/**
 * 按当前循环模式列出后续 N 章（不含当前章）。
 * 池激活时以池队列为准；否则按 repeat 模式顺章推进——
 * 这是非池播放（阅读页直接点播）也能填满原生队列的关键。
 */
export function peekUpcomingScriptureChapters(args: {
  bookId: string;
  chapter: number;
  repeatMode: ScriptureAudioRepeatMode;
  count?: number;
}): ChapterRef[] {
  const count = Math.max(0, args.count ?? SCRIPTURE_NATIVE_NEXT_PREFETCH);
  if (count === 0) return [];
  // 单章循环：原生不需要下一章，续播由章末回调 seek 回 0。
  if (args.repeatMode === "chapter") return [];

  if (scriptureChapterPool.isActive()) {
    return scriptureChapterPool
      .peekUpcoming(count)
      .map((track) => ({ bookId: track.bookId, chapter: track.chapter }));
  }

  const out: ChapterRef[] = [];
  let cursor: ChapterRef = { bookId: args.bookId, chapter: args.chapter };
  for (let i = 0; i < count; i += 1) {
    const next =
      args.repeatMode === "book"
        ? getNextScriptureChapterInBook(cursor.bookId, cursor.chapter)
        : getNextScriptureChapter(cursor.bookId, cursor.chapter);
    if (!next) break;
    // 本卷循环绕回起点：再往下就是重复，够原生连播即可。
    if (out.some((c) => c.bookId === next.bookId && c.chapter === next.chapter)) break;
    if (next.bookId === args.bookId && next.chapter === args.chapter) break;
    out.push(next);
    cursor = next;
  }
  return out;
}

/**
 * 把后续章解析成原生播放器可直接播的 URI 列表（本地优先，没有则 HTTPS）。
 * 解析失败的章跳过，不阻断后面的——队列宁可短一点也不要断在中间。
 */
export async function buildScriptureNativeNextUris(args: {
  bookId: string;
  chapter: number;
  translationId: string;
  repeatMode: ScriptureAudioRepeatMode;
  voiceId?: CuvChapterAudioVoiceId;
  count?: number;
}): Promise<string[]> {
  const upcoming = peekUpcomingScriptureChapters({
    bookId: args.bookId,
    chapter: args.chapter,
    repeatMode: args.repeatMode,
    count: args.count,
  });
  if (upcoming.length === 0) return [];

  const resolved = await Promise.all(
    upcoming.map(async (ref) => {
      const bookName = getScriptureBookDisplayName(ref.bookId);
      const src = await resolveScripturePlayableSrcForChapter({
        translationId: args.translationId,
        bookId: ref.bookId,
        chapter: ref.chapter,
        bookName,
        voiceId: args.voiceId,
      });
      if (!src) return null;
      const uri = await resolveIosNativeScriptureAssetUri({
        src,
        translationId: args.translationId,
        bookId: ref.bookId,
        chapter: ref.chapter,
        voiceId: args.voiceId,
      });
      /*
       * 记下这条 URI 是哪一章。原生接播后 JS 按 URI 查表即可知道章号，
       * 不必再照着同一套规则独立推演一遍（推演两次就会有两个答案）。
       */
      if (uri) {
        rememberScriptureQueueChapter(uri, {
          bookId: ref.bookId,
          chapter: ref.chapter,
          translationId: args.translationId,
        });
      }
      return uri;
    }),
  );
  return resolved.filter((uri): uri is string => Boolean(uri));
}
