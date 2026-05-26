export const SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY = "selah-scripture-verse-bookmarks-v1";

export type ScriptureVerseBookmark = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  translationId: string;
  text: string;
  savedAt: number;
};

export type ScriptureVerseBookmarkStore = Record<string, ScriptureVerseBookmark>;

export type ScriptureVerseBookmarkRef = Pick<
  ScriptureVerseBookmark,
  "bookId" | "bookName" | "chapter" | "verse" | "translationId" | "text"
>;

export function scriptureVerseBookmarkKey(
  ref: Pick<ScriptureVerseBookmark, "translationId" | "bookId" | "chapter" | "verse">,
): string {
  return `${ref.translationId}:${ref.bookId}:${ref.chapter}:${ref.verse}`;
}

export function parseScriptureVerseBookmarkStore(raw: string | null): ScriptureVerseBookmarkStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ScriptureVerseBookmarkStore;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ScriptureVerseBookmarkStore = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (!item || typeof item !== "object") continue;
      if (!item.bookId || !item.translationId) continue;
      if (!Number.isInteger(item.chapter) || item.chapter < 1) continue;
      if (!Number.isInteger(item.verse) || item.verse < 1) continue;
      out[key] = {
        bookId: String(item.bookId).trim().toUpperCase(),
        bookName: String(item.bookName || item.bookId),
        chapter: item.chapter,
        verse: item.verse,
        translationId: String(item.translationId),
        text: String(item.text || ""),
        savedAt: typeof item.savedAt === "number" ? item.savedAt : Date.now(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function listScriptureVerseBookmarks(store: ScriptureVerseBookmarkStore): ScriptureVerseBookmark[] {
  return Object.values(store).sort((a, b) => b.savedAt - a.savedAt);
}
