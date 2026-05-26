import type { VerseRef } from "@/lib/bible/verse-ref";

export const SITE_VERSE_POOL_MAX_REFS = 240;

function verseRefKey(ref: VerseRef): string {
  const tid = ref.translationId?.trim() ?? "";
  return `${ref.bookId}:${ref.chapter}:${ref.verseStart}:${ref.verseEnd}:${tid}`;
}

/**
 * Normalize deduped refs and cap pool size for legacy fallback readers.
 */
export function capSiteVersePoolRefs(refs: ReadonlyArray<VerseRef>): VerseRef[] {
  const out: VerseRef[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = verseRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (out.length >= SITE_VERSE_POOL_MAX_REFS) break;
  }
  return out;
}
