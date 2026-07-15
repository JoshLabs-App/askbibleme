import { SCRIPTURE_BOOK_NAME_EN } from "./scripture-book-names-en";
import { OLD_TESTAMENT_MAX_BOOK_NUMBER, scriptureBooks } from "./scripture-books";

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

/** eBible.org WEBP 专属完整录音（OGG）逐章地址。 */
export function webpChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  const n = bookNumberById.get(id);
  if (!n || !Number.isInteger(chapter) || chapter < 1) return "";
  const name = id === "PSA"
    ? "Psalms"
    : id === "SNG"
      ? "SongOfSolomon"
      : id === "1CH"
        ? "1Chron"
        : id === "2CH"
          ? "2Chron"
          : (SCRIPTURE_BOOK_NAME_EN[id] ?? id).replace(/\s+/g, "");
  const dir = `${String(n).padStart(2, "0")}_${name}`;
  const unpaddedChapterBooks = new Set([
    "AMO", "OBA", "JOL", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "MAL",
    "LAM", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT",
    "PHM", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
  ]);
  const chapterToken = unpaddedChapterBooks.has(id)
    ? String(chapter)
    : String(chapter).padStart(2, "0");
  const filenamePrefix = id === "GAL"
    ? "40_Galatians"
    : id === "COL"
      ? "52_Colossians"
      : dir;
  const separator = id === "JON" ? "_" : "_C";
  return `https://ebible.org/engwebp/ogg/${dir}/${filenamePrefix}${separator}${chapterToken}.ogg`;
}
