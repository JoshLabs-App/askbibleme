import { webChapterAudioBookNameEn } from "@/lib/bible/web-chapter-audio-book-names";
import { scriptureBooks } from "@/lib/bible/scripture-books";

const ENTRIES = scriptureBooks.map((b) => ({
  bookId: b.bookId,
  name: webChapterAudioBookNameEn(b.bookId),
}));

/** 先匹配较长书名，避免「John」误命中「1 John」。 */
const BOOKS_BY_NAME_LEN = [...ENTRIES].sort((a, b) => b.name.length - a.name.length);

export function englishBookNameToBookId(name: string): string | null {
  const n = String(name ?? "").trim();
  if (!n) return null;
  for (const b of BOOKS_BY_NAME_LEN) {
    if (b.name === n) return b.bookId;
  }
  return null;
}
