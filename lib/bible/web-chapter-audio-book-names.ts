import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";
import { OLD_TESTAMENT_MAX_BOOK_NUMBER, scriptureBooks } from "@/lib/bible/scripture-books";

/** theaudiopower.org WEB 录音与 OSIS 显示名不一致的书卷 */
const WEB_AUDIO_BOOK_NAME_OVERRIDES: Partial<Record<string, string>> = {
  PSA: "Psalms",
  SNG: "Song of Solomon",
};

const bookNumberById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookNumber]));

/** 用于外链 MP3：`{English book name} {chapter}.mp3` */
export function webChapterAudioBookNameEn(bookId: string): string {
  const id = String(bookId || "").trim().toUpperCase();
  const override = WEB_AUDIO_BOOK_NAME_OVERRIDES[id];
  if (override) return override;
  return SCRIPTURE_BOOK_NAME_EN[id] ?? id;
}

export function isOldTestamentBookId(bookId: string): boolean {
  const n = bookNumberById.get(String(bookId || "").trim().toUpperCase());
  return n != null && n <= OLD_TESTAMENT_MAX_BOOK_NUMBER;
}

export function webChapterAudioRemoteBase(bookId: string): string {
  return isOldTestamentBookId(bookId)
    ? "https://theaudiopower.org/WEB2/Recordings"
    : "https://theaudiopower.org/WEB/Recordings";
}
