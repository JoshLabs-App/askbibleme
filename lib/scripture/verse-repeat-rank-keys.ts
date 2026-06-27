export type VerseCoord = {
  bookId: string;
  chapter: number;
  verse: number;
};

export function verseRepeatRankRowKey(row: VerseCoord): string {
  return `${row.bookId}:${row.chapter}:${row.verse}`;
}

export function parseVerseRepeatRankRowKey(key: string): VerseCoord | null {
  const parts = String(key ?? "").trim().split(":");
  if (parts.length !== 3) return null;
  const bookId = parts[0]!.trim().toUpperCase();
  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!bookId || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    return null;
  }
  return { bookId, chapter, verse };
}
