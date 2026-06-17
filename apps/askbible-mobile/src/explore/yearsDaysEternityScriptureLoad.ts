import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { parseZhRefParts } from "./yearsDaysEternityRefUtils";

function formatLoadedVerses(lines: string[]): string {
  const cleaned = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  return cleaned.join(" ");
}

export async function loadEternityEnScriptureBodiesForRefs(
  refs: string[],
): Promise<Record<string, string>> {
  const chapterCache = new Map<
    string,
    Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>
  >();
  const next: Record<string, string> = {};

  for (const ref of refs) {
    const parsed = parseZhRefParts(ref);
    if (!parsed) continue;
    const lines: string[] = [];
    for (const part of parsed.parts) {
      const chapterKey = `${parsed.bookId}:${part.chapter}`;
      if (!chapterCache.has(chapterKey)) {
        try {
          const loaded = await loadChapterFromBundledTranslation(
            parsed.bookId,
            part.chapter,
            "web-en",
          );
          chapterCache.set(chapterKey, loaded);
        } catch {
          chapterCache.set(chapterKey, null);
        }
      }
      const loaded = chapterCache.get(chapterKey);
      if (!loaded) continue;
      for (const verse of loaded.verses) {
        if (verse.verse >= part.start && verse.verse <= part.end) {
          lines.push(verse.text);
        }
      }
    }
    if (lines.length > 0) next[ref] = formatLoadedVerses(lines);
  }
  return next;
}
