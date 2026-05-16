import type { VerseRef } from "@/lib/bible/verse-ref";

/** 全站唯一经文池上限（Admin 金句主题 → `external-home-verse-rotation.json` → 前台 chunk）。 */
export const SITE_VERSE_POOL_MAX = 400;

export function capSiteVersePoolRefs(refs: VerseRef[]): VerseRef[] {
  if (refs.length <= SITE_VERSE_POOL_MAX) return refs;
  return refs.slice(0, SITE_VERSE_POOL_MAX);
}
