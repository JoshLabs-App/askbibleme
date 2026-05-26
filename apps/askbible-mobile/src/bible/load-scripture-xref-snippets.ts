import { loadChapterFromBundledTranslation } from "./load-chapter";
import type { ScriptureXrefTarget } from "./scripture-xref-types";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "./types";

export function scriptureXrefSnippetKey(ref: ScriptureXrefTarget): string {
  const end = ref.verseEnd ?? ref.verseStart;
  return `${ref.bookId}:${ref.chapter}:${ref.verseStart}:${end}`;
}

function joinVerseRangeText(
  verses: { verse: number; text: string }[],
  verseStart: number,
  verseEnd: number,
): string {
  const end = verseEnd >= verseStart ? verseEnd : verseStart;
  return verses
    .filter((v) => v.verse >= verseStart && v.verse <= end)
    .map((v) => v.text.trim())
    .filter(Boolean)
    .join(" ");
}

export async function loadScriptureXrefSnippets(
  translationId: string,
  refs: ScriptureXrefTarget[],
): Promise<Record<string, string>> {
  const tid = String(translationId || DEFAULT_SCRIPTURE_TRANSLATION_ID).trim();
  if (!refs.length) return {};

  const chapterCache = new Map<string, Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>>();
  const out: Record<string, string> = {};

  for (const ref of refs) {
    const key = scriptureXrefSnippetKey(ref);
    if (out[key]) continue;

    const bookId = ref.bookId.trim().toUpperCase();
    const chKey = `${tid}:${bookId}:${ref.chapter}`;
    let loaded = chapterCache.get(chKey);
    if (loaded === undefined) {
      loaded = await loadChapterFromBundledTranslation(bookId, ref.chapter, tid);
      chapterCache.set(chKey, loaded);
    }
    if (!loaded) continue;

    const end = ref.verseEnd ?? ref.verseStart;
    const raw = joinVerseRangeText(loaded.verses, ref.verseStart, end);
    if (raw) out[key] = raw;
  }

  return out;
}
