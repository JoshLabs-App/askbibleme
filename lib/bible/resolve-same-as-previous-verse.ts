/** 译本中「本节同上一节」占位（简/繁/OTB 等）。英文等译本通常有完整正文，不在此列。 */
const SAME_AS_PREVIOUS_VERSE_PATTERNS = [
  /^[\s]*[并並併][于於]上[节節][。.]?[\s]*$/,
  /^[\s]*[（(][见見]上[节節][）)][。.]?[\s]*$/,
] as const;

export function isSameAsPreviousVerseMarker(text: string): boolean {
  const t = text.trim();
  return SAME_AS_PREVIOUS_VERSE_PATTERNS.some((re) => re.test(t));
}

/** 「并于上节 / 併於上節 / （见上节）」等占位：向前回溯到最近可展示正文。 */
export function resolveSameAsPreviousVerseText(
  verse: number,
  rawText: string,
  verseTextByVerse: ReadonlyMap<number, string>,
): string {
  if (!isSameAsPreviousVerseMarker(rawText)) return rawText;
  for (let prev = verse - 1; prev >= 1; prev -= 1) {
    const hit = verseTextByVerse.get(prev);
    if (!hit) continue;
    const t = hit.trim();
    if (!t || isSameAsPreviousVerseMarker(t)) continue;
    return hit;
  }
  return rawText;
}
