import { parseOpenbibleOsisToVerseSpan } from "@/lib/bible/osis-openbible-book";

/** 解析为「同书同章连续 OSIS」时的经节数量；否则 null（跨章、未知缩写等）。 */
export function computeOpenbibleOsisVerseCount(osis: string): number | null {
  const span = parseOpenbibleOsisToVerseSpan(osis);
  if (!span) return null;
  return span.verseEnd - span.verseStart + 1;
}
