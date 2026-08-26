import { bookNameForId } from "./canonCatalog";
import {
  getActiveReadChapterPlayback,
  getPlayingReadChapterPlayback,
} from "./read-chapter-playback-store";
import { getScripturePlayingChapter } from "../music/scripturePlayingChapterStore";

/** 从章页路由解析 bookId / chapter（`/read/GEN/1` 或 `/(tabs)/read/GEN/1`）。 */
export function parseReadChapterPathname(
  pathname: string,
): { bookId: string; chapter: number } | null {
  const p = (pathname.replace(/\/$/, "") || "/").replace(/^\/+/, "/");
  const m = p.match(/(?:^|\/)(?:\(tabs\)\/)?read\/([A-Za-z0-9_]+)\/(\d+)$/i);
  if (!m) return null;
  const bookId = String(m[1] ?? "")
    .trim()
    .toUpperCase();
  const chapter = Number(m[2]);
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter };
}

/**
 * 章页点播放的目标：以路由章为准（不依赖可能仍钉在计划轨上的 browse/ref）。
 * 译本名优先用已注册 browse，否则目录名；译本 id 优先显式传入 → 同章 browse → playing → 在播章。
 */
export function resolveChapterPageScripturePlayTarget(
  pathname: string,
  route?: { bookId?: string; chapter?: number; translationId?: string },
): {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
} | null {
  const fromPath = parseReadChapterPathname(pathname);
  const bookId = (route?.bookId?.trim() || fromPath?.bookId || "").toUpperCase();
  const chapter =
    route?.chapter && Number.isInteger(route.chapter) && route.chapter >= 1
      ? route.chapter
      : (fromPath?.chapter ?? 0);
  if (!bookId || chapter < 1) return null;

  const browse = getActiveReadChapterPlayback();
  const playingReg = getPlayingReadChapterPlayback();
  const playingChapter = getScripturePlayingChapter();
  const sameBrowse =
    browse != null && browse.bookId === bookId && browse.chapter === chapter;

  const translationId =
    route?.translationId?.trim() ||
    (sameBrowse ? browse.translationId : null) ||
    (playingReg && playingReg.bookId === bookId && playingReg.chapter === chapter
      ? playingReg.translationId
      : null) ||
    playingChapter?.translationId ||
    browse?.translationId ||
    playingReg?.translationId ||
    "cuv-simp";

  return {
    bookId,
    chapter,
    bookName: sameBrowse ? browse.bookName : bookNameForId(bookId),
    translationId,
  };
}
