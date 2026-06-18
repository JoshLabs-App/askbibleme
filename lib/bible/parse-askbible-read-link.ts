/** Parse `askbible://read/ISA/61?verse=1` style deep links. */
export function parseAskbibleReadLink(
  href: string,
): { bookId: string; chapter: number; verse?: number } | null {
  const raw = String(href || "").trim();
  const m = /^askbible:\/\/read\/([A-Za-z0-9]{2,5})\/(\d+)(?:\?verse=(\d+))?$/i.exec(raw);
  if (!m) return null;
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const verseRaw = m[3];
  const verse = verseRaw != null ? Number(verseRaw) : undefined;
  if (verse != null && (!Number.isInteger(verse) || verse < 1)) return null;
  return {
    bookId: m[1]!.toUpperCase(),
    chapter,
    verse,
  };
}

export function parseReadPath(
  href: string,
): { bookId: string; chapter: number; verse?: number } | null {
  const raw = String(href || "").trim();
  const m = /^\/read\/([A-Za-z0-9]{2,5})\/(\d+)(?:\?verse=(\d+))?$/i.exec(raw);
  if (!m) return null;
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const verseRaw = m[3];
  const verse = verseRaw != null ? Number(verseRaw) : undefined;
  if (verse != null && (!Number.isInteger(verse) || verse < 1)) return null;
  return {
    bookId: m[1]!.toUpperCase(),
    chapter,
    verse,
  };
}

export function askbibleReadPath(link: {
  bookId: string;
  chapter: number;
  verse?: number;
}): string {
  const base = `/read/${encodeURIComponent(link.bookId)}/${link.chapter}`;
  if (link.verse != null) return `${base}?verse=${link.verse}`;
  return base;
}
