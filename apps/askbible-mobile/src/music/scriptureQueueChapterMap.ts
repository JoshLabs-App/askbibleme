import type { ChapterQueueRef } from "./scripturePlaybackTypes";

/**
 * 记住"原生队列里每个 URI 对应哪一章"。
 *
 * 原生只认 URI，章号在 JS 这边。以前的做法是：原生接播下一章后通知 JS，JS **照着原生同一套
 * 规则再算一遍**下一章是谁（`peekUpcomingScriptureChapters`），算出来的结果理论上应该一致。
 * 两处独立推演同一件事，就是这一周所有 bug 的形状——不一致时没人发现，界面章号就跟音轨错开。
 *
 * 现在建队列时顺手记下映射，接播后按 URI 查表。**只有一处知道顺序，就是建队列那次。**
 *
 * 容量有限且只增不减地覆盖：URI 会重复（循环播放同一卷），后写的覆盖先写的即可。
 */
const MAX_ENTRIES = 400;

const uriToChapter = new Map<string, ChapterQueueRef>();

function normalize(uri: string): string {
  return uri.trim();
}

export function rememberScriptureQueueChapter(uri: string, ref: ChapterQueueRef): void {
  const key = normalize(uri);
  if (!key) return;
  if (uriToChapter.size >= MAX_ENTRIES && !uriToChapter.has(key)) {
    const oldest = uriToChapter.keys().next().value;
    if (oldest) uriToChapter.delete(oldest);
  }
  uriToChapter.set(key, ref);
}

export function lookupScriptureQueueChapter(uri: string | null | undefined): ChapterQueueRef | null {
  if (!uri) return null;
  return uriToChapter.get(normalize(uri)) ?? null;
}

/** 仅供测试。 */
export function clearScriptureQueueChapterMap(): void {
  uriToChapter.clear();
}
