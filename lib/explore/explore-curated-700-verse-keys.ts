import { scriptureBooks } from "@/lib/bible/scripture-books";
import {
  EXPLORE_CURATED_700_EXTRA_VERSE_KEY,
  EXPLORE_CURATED_700_TARGET_COUNT,
} from "@/lib/scripture/explore-curated-pool-scope-id";
import {
  HOME_VERSE_POOL_SCOPE_KEYS,
  homeVersePoolAllPriority,
} from "@/lib/explore/explore-home-verse-pool-scopes";

export { EXPLORE_CURATED_700_EXTRA_VERSE_KEY } from "@/lib/scripture/explore-curated-pool-scope-id";

const bookOrder = new Map(scriptureBooks.map((book, idx) => [book.bookId, idx]));

function parseVerseKey(verseKey: string): { bookId: string; chapter: number; verse: number } | null {
  const m = /^([A-Z0-9]{3})\.(\d+)\.(\d+)$/.exec(verseKey.trim().toUpperCase());
  if (!m) return null;
  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) return null;
  return { bookId: m[1]!, chapter, verse };
}

export function sortExploreCurated700VerseKeysCanonically(keys: Iterable<string>): string[] {
  return [...keys].sort((a, b) => {
    const pa = parseVerseKey(a);
    const pb = parseVerseKey(b);
    if (!pa || !pb) return a.localeCompare(b);
    const ba = bookOrder.get(pa.bookId) ?? 999;
    const bb = bookOrder.get(pb.bookId) ?? 999;
    return ba - bb || pa.chapter - pb.chapter || pa.verse - pb.verse || a.localeCompare(b);
  });
}

/** 与探索「全部」范围一致：按子库优先级排序（`all` scope 轮播顺序）。 */
export function sortExploreCurated700VerseKeysForRotation(keys: Iterable<string>): string[] {
  return [...keys]
    .map((key, idx) => ({ key, idx, p: homeVersePoolAllPriority(key) }))
    .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.idx - b.idx))
    .map((row) => row.key);
}

export const EXPLORE_CURATED_700_VERSE_KEYS = sortExploreCurated700VerseKeysForRotation(
  HOME_VERSE_POOL_SCOPE_KEYS.all,
);

if (EXPLORE_CURATED_700_VERSE_KEYS.length !== EXPLORE_CURATED_700_TARGET_COUNT) {
  throw new Error(
    `EXPLORE_CURATED_700_VERSE_KEYS expected ${EXPLORE_CURATED_700_TARGET_COUNT}, got ${EXPLORE_CURATED_700_VERSE_KEYS.length}`,
  );
}
