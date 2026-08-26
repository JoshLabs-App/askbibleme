import { clearPlayingReadChapterPlayback } from "../read/read-chapter-playback-store";

/** 当前音轨实际对应的章（与 UI browse 注册分离：切章浏览时 browse 会变，音轨章不变）。 */
export type ScripturePlayingChapter = {
  bookId: string;
  chapter: number;
  translationId: string;
};

let current: ScripturePlayingChapter | null = null;
const listeners = new Set<() => void>();

function sameChapter(
  a: ScripturePlayingChapter | null,
  b: ScripturePlayingChapter | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.bookId === b.bookId && a.chapter === b.chapter && a.translationId === b.translationId;
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function setScripturePlayingChapter(next: ScripturePlayingChapter | null): void {
  if (sameChapter(current, next)) return;
  current = next;
  notify();
}

export function clearScripturePlayingChapter(): void {
  setScripturePlayingChapter(null);
  // 身份清空时同步清运输注册，避免锁屏 Next 仍指向旧回调。
  clearPlayingReadChapterPlayback();
}

export function getScripturePlayingChapter(): ScripturePlayingChapter | null {
  return current;
}

export function subscribeScripturePlayingChapter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isScripturePlayingChapter(
  chapter: { bookId: string; chapter: number; translationId?: string } | null | undefined,
): boolean {
  if (!current || !chapter) return false;
  if (current.bookId !== chapter.bookId || current.chapter !== chapter.chapter) return false;
  if (chapter.translationId != null && chapter.translationId !== current.translationId) {
    return false;
  }
  return true;
}
