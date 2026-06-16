import { InteractionManager } from "react-native";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import type { LoadedChapter } from "../bible/types";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "../bible/types";
import type { AppLocale } from "../i18n/config";

export type ExploreScriptureRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
};

const exploreChapterCache = new Map<string, LoadedChapter | null>();

function translationIdForLocale(locale: AppLocale): string {
  if (locale === "en") return "web-en";
  if (locale === "zh-TW") return "cuv-trad";
  return DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

function verseTextFromChapter(
  chapterText: { verse: number; text: string }[],
  ref: ExploreScriptureRef,
): string | null {
  const byVerse = new Map<number, string>();
  for (const row of chapterText) byVerse.set(row.verse, row.text);
  const parts = ref.verseList
    .map((v) => byVerse.get(v)?.trim() ?? "")
    .filter(Boolean);
  if (!parts.length) return null;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return parts.join(hasHan ? "" : " ");
}

async function loadExploreChapterCached(
  bookId: string,
  chapter: number,
  translationId: string,
): Promise<LoadedChapter | null> {
  const cacheKey = `${translationId}:${bookId}:${chapter}`;
  if (exploreChapterCache.has(cacheKey)) {
    return exploreChapterCache.get(cacheKey) ?? null;
  }
  try {
    const loaded = await loadChapterFromBundledTranslation(bookId, chapter, translationId);
    exploreChapterCache.set(cacheKey, loaded);
    return loaded;
  } catch {
    exploreChapterCache.set(cacheKey, null);
    return null;
  }
}

/** 展开手风琴后再加载经文，避免与首屏滚动/动画抢线程。 */
export function scheduleExploreCategoryVerseLoad(work: () => void | Promise<void>): {
  cancel: () => void;
} {
  return InteractionManager.runAfterInteractions(() => {
    void work();
  });
}

/** Load bundled verse text for a subset of refs (one accordion category at a time). */
export async function loadExploreVerseTextsForRefs(
  refs: string[],
  parsedByRaw: Record<string, ExploreScriptureRef | null>,
  locale: AppLocale,
  unavailableLabel: string,
): Promise<Record<string, string>> {
  const translationId = translationIdForLocale(locale);
  const next: Record<string, string> = {};
  const refsByChapter = new Map<string, string[]>();

  for (const raw of refs) {
    const parsed = parsedByRaw[raw];
    if (!parsed) {
      next[raw] = unavailableLabel;
      continue;
    }
    const chapterKey = `${parsed.bookId}:${parsed.chapter}`;
    const bucket = refsByChapter.get(chapterKey) ?? [];
    bucket.push(raw);
    refsByChapter.set(chapterKey, bucket);
  }

  for (const [, rawRefs] of refsByChapter) {
    const anchor = parsedByRaw[rawRefs[0]!];
    if (!anchor) continue;
    const loaded = await loadExploreChapterCached(anchor.bookId, anchor.chapter, translationId);
    for (const raw of rawRefs) {
      const parsed = parsedByRaw[raw];
      if (!parsed) {
        next[raw] = unavailableLabel;
        continue;
      }
      const resolved = loaded ? verseTextFromChapter(loaded.verses, parsed) : null;
      next[raw] = resolved ?? unavailableLabel;
    }
  }

  return next;
}

/** 分批加载并在章与章之间让出主线程，避免大分类一次性卡住 UI。 */
export async function loadExploreVerseTextsForRefsProgressive(
  refs: string[],
  parsedByRaw: Record<string, ExploreScriptureRef | null>,
  locale: AppLocale,
  unavailableLabel: string,
  onBatch?: (partial: Record<string, string>) => void,
): Promise<Record<string, string>> {
  const translationId = translationIdForLocale(locale);
  const next: Record<string, string> = {};
  const refsByChapter = new Map<string, string[]>();

  for (const raw of refs) {
    const parsed = parsedByRaw[raw];
    if (!parsed) {
      next[raw] = unavailableLabel;
      onBatch?.({ [raw]: unavailableLabel });
      continue;
    }
    const chapterKey = `${parsed.bookId}:${parsed.chapter}`;
    const bucket = refsByChapter.get(chapterKey) ?? [];
    bucket.push(raw);
    refsByChapter.set(chapterKey, bucket);
  }

  const chapterEntries = [...refsByChapter.entries()];
  for (let i = 0; i < chapterEntries.length; i += 1) {
    const [, rawRefs] = chapterEntries[i]!;
    const anchor = parsedByRaw[rawRefs[0]!];
    if (!anchor) continue;
    const loaded = await loadExploreChapterCached(anchor.bookId, anchor.chapter, translationId);
    const batch: Record<string, string> = {};
    for (const raw of rawRefs) {
      const parsed = parsedByRaw[raw];
      if (!parsed) {
        batch[raw] = unavailableLabel;
        continue;
      }
      const resolved = loaded ? verseTextFromChapter(loaded.verses, parsed) : null;
      batch[raw] = resolved ?? unavailableLabel;
    }
    Object.assign(next, batch);
    onBatch?.(batch);
    if (i + 1 < chapterEntries.length) {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
    }
  }

  return next;
}

export function clearExploreChapterVerseCache(): void {
  exploreChapterCache.clear();
}
