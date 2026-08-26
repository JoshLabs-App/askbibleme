import { scriptureBooks } from "@/lib/bible/scripture-books";

export function parseReadChapterPathname(
  pathname: string,
): { bookId: string; chapter: number } | null {
  const p = (pathname.replace(/\/$/, "") || "/").replace(/^\/+/, "/");
  const m = p.match(/^\/read\/([A-Za-z0-9_]+)\/(\d+)$/i);
  if (!m) return null;
  const bookId = String(m[1] ?? "")
    .trim()
    .toUpperCase();
  const chapter = Number(m[2]);
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter };
}

/** 章页点播放的目标：以路由章为准。 */
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

  const meta = scriptureBooks.find((b) => b.bookId === bookId);
  const translationId = route?.translationId?.trim() || "cuv-simp";

  return {
    bookId,
    chapter,
    bookName: meta?.bookName ?? bookId,
    translationId,
  };
}
