export const SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY = "selah-scripture-verse-bookmarks-v1";
export const SCRIPTURE_VERSE_BOOKMARK_TOMBSTONES_STORAGE_KEY =
  "askbible-scripture-verse-bookmark-tombstones-v1";
export const SCRIPTURE_VERSE_BOOKMARK_TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export type ScriptureVerseBookmark = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  translationId: string;
  text: string;
  savedAt: number;
};

export type ScriptureVerseBookmarkTombstone = {
  deleted: true;
  deletedAt: number;
};

export type ScriptureVerseBookmarkStore = Record<string, ScriptureVerseBookmark>;
export type ScriptureVerseBookmarkTombstoneStore = Record<string, number>;

export type ScriptureVerseBookmarkRef = Pick<
  ScriptureVerseBookmark,
  "bookId" | "bookName" | "chapter" | "verse" | "translationId" | "text"
>;

export function scriptureVerseBookmarkKey(
  ref: Pick<ScriptureVerseBookmark, "translationId" | "bookId" | "chapter" | "verse">,
): string {
  return `${ref.translationId}:${ref.bookId}:${ref.chapter}:${ref.verse}`;
}

function isFreshTombstoneTs(ts: unknown, nowMs: number): ts is number {
  return (
    typeof ts === "number" &&
    Number.isFinite(ts) &&
    ts > 0 &&
    nowMs - ts <= SCRIPTURE_VERSE_BOOKMARK_TOMBSTONE_TTL_MS
  );
}

export function parseScriptureVerseBookmarkStore(raw: string | null): ScriptureVerseBookmarkStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ScriptureVerseBookmarkStore = {};
    for (const [key, rawItem] of Object.entries(parsed)) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
      const item = rawItem as Partial<ScriptureVerseBookmark> & { deleted?: unknown };
      if (item.deleted === true) continue;
      if (!item.bookId || !item.translationId) continue;
      if (!Number.isInteger(item.chapter) || (item.chapter ?? 0) < 1) continue;
      if (!Number.isInteger(item.verse) || (item.verse ?? 0) < 1) continue;
      out[key] = {
        bookId: String(item.bookId).trim().toUpperCase(),
        bookName: String(item.bookName || item.bookId),
        chapter: item.chapter as number,
        verse: item.verse as number,
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

export function parseScriptureVerseBookmarkTombstones(
  raw: string | null,
  nowMs = Date.now(),
): ScriptureVerseBookmarkTombstoneStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ScriptureVerseBookmarkTombstoneStore = {};
    for (const [key, ts] of Object.entries(parsed)) {
      if (isFreshTombstoneTs(ts, nowMs)) {
        out[key] = ts;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function pruneScriptureVerseBookmarkTombstones(
  tombstones: ScriptureVerseBookmarkTombstoneStore,
  nowMs = Date.now(),
): ScriptureVerseBookmarkTombstoneStore {
  const out: ScriptureVerseBookmarkTombstoneStore = {};
  for (const [key, ts] of Object.entries(tombstones)) {
    if (isFreshTombstoneTs(ts, nowMs)) out[key] = ts;
  }
  return out;
}

export function extractBookmarkTombstonesFromSyncValue(
  value: unknown,
  nowMs = Date.now(),
): ScriptureVerseBookmarkTombstoneStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ScriptureVerseBookmarkTombstoneStore = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as { deleted?: unknown; deletedAt?: unknown };
    if (rec.deleted !== true) continue;
    const ts = Number(rec.deletedAt ?? 0);
    if (isFreshTombstoneTs(ts, nowMs)) {
      out[key] = ts;
    }
  }
  return out;
}

export function exportBookmarkSyncValue(
  store: ScriptureVerseBookmarkStore,
  tombstones: ScriptureVerseBookmarkTombstoneStore,
  nowMs = Date.now(),
): Record<string, ScriptureVerseBookmark | ScriptureVerseBookmarkTombstone> {
  const out: Record<string, ScriptureVerseBookmark | ScriptureVerseBookmarkTombstone> = {
    ...store,
  };
  for (const [key, deletedAt] of Object.entries(tombstones)) {
    if (out[key]) continue;
    if (isFreshTombstoneTs(deletedAt, nowMs)) {
      out[key] = { deleted: true, deletedAt };
    }
  }
  return out;
}

export function listScriptureVerseBookmarks(store: ScriptureVerseBookmarkStore): ScriptureVerseBookmark[] {
  return Object.values(store).sort((a, b) => b.savedAt - a.savedAt);
}
