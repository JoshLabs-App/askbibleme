import { joinVerseRangeText, scriptureXrefSnippetKey } from "@/lib/bible/join-verse-range-text";
import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { normalizeVerseTextForHomeDisplay } from "@/lib/bible/normalize-verse-text-for-home-display";
import { stripZhVerseDisplayNotes } from "@/lib/bible/strip-zh-verse-display-notes";
import type { VerseRef } from "@/lib/bible/verse-ref";
import type { AppLocale } from "@/lib/i18n/config";

function normalizeSnippetText(text: string, locale: AppLocale): string {
  let t = normalizeVerseTextForHomeDisplay(text);
  if (locale === "zh-CN") {
    t = stripZhVerseDisplayNotes(t);
  }
  return t.trim() || text.trim();
}

/** 批量解析 xref 目标经节正文（按章缓存，供 Web API / 服务端用）。 */
export async function loadScriptureXrefSnippets(
  cwd: string,
  translationId: string,
  refs: VerseRef[],
  locale: AppLocale = "zh-CN",
): Promise<Record<string, string>> {
  const tid = translationId.trim();
  if (!tid || !refs.length) return {};

  const chapterCache = new Map<string, Awaited<ReturnType<typeof loadChapterFromTranslation>>>();
  const out: Record<string, string> = {};

  for (const ref of refs) {
    const key = scriptureXrefSnippetKey(ref);
    if (out[key]) continue;

    const bookId = ref.bookId.trim().toUpperCase();
    const chKey = `${tid}:${bookId}:${ref.chapter}`;
    let loaded = chapterCache.get(chKey);
    if (loaded === undefined) {
      loaded = await loadChapterFromTranslation(cwd, bookId, ref.chapter, tid);
      chapterCache.set(chKey, loaded);
    }
    if (!loaded) continue;

    const end = ref.verseEnd ?? ref.verseStart;
    const raw = joinVerseRangeText(loaded.verses, ref.verseStart, end);
    if (!raw) continue;
    out[key] = normalizeSnippetText(raw, locale);
  }

  return out;
}
