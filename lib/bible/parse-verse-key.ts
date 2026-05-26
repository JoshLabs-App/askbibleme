export type ParsedVerseKey = {
  bookId: string;
  chapter: number;
  verse: number;
};

/** 解析 `public/data/home-prayer-pools` 中的 `verseKey`（如 `PRO.3.5`、`GEN.1.1-GEN.1.3`）。 */
export function parseVerseKey(key: string): ParsedVerseKey | null {
  const s = String(key || "").trim().toUpperCase();
  if (!s) return null;

  const range = s.match(/^([A-Z0-9]{2,8})\.(\d+)\.(\d+)-/);
  if (range) {
    const chapter = Number(range[2]);
    const verse = Number(range[3]);
    if (Number.isInteger(chapter) && chapter >= 1 && Number.isInteger(verse) && verse >= 1) {
      return { bookId: range[1]!, chapter, verse };
    }
    return null;
  }

  const single = s.match(/^([A-Z0-9]{2,8})\.(\d+)\.(\d+)$/);
  if (!single) return null;
  const chapter = Number(single[2]);
  const verse = Number(single[3]);
  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    return null;
  }
  return { bookId: single[1]!, chapter, verse };
}

/** Web 读经章 URL（含 `?verse=` 定位节）。 */
export function readChapterHrefFromVerseKey(verseKey: string): string | null {
  const loc = parseVerseKey(verseKey);
  if (!loc) return null;
  return `/read/${encodeURIComponent(loc.bookId)}/${loc.chapter}?verse=${loc.verse}`;
}
