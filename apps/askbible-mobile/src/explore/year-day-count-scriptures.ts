import { InteractionManager } from "react-native";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { LoadedChapter } from "../bible/types";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "../bible/types";
import { getLocale } from "../i18n/locale-store";
import { toZhTwText } from "../i18n/site-copy";
import {
  type YearDayCountScriptureRef,
  getYearDayCountScriptures,
} from "./year-day-count-refs";
export {
  type YearDayCountScriptureRef,
  getYearDayCountLifeDayReadTarget,
  getYearDayCountLeadRef,
  getYearDayCountScriptures,
} from "./year-day-count-refs";

const yearDayCountChapterCache = new Map<string, LoadedChapter | null>();
let yearDayCountTextsPromise: Promise<Record<string, string>> | null = null;
let yearDayCountTextsLocaleKey: string | null = null;

export function formatYearDayCountRef(ref: YearDayCountScriptureRef): string {
  const locale = getLocale();
  const baseName = getScriptureBookDisplayName(ref.bookId, locale);
  const name = locale === "zh-TW" ? toZhTwText(baseName) : baseName;
  const range =
    ref.verseEnd != null && ref.verseEnd > ref.verseStart
      ? `${ref.verseStart}-${ref.verseEnd}`
      : String(ref.verseStart);
  return `${name} ${ref.chapter}:${range}`;
}

function translationIdForLocale(): string {
  const locale = getLocale();
  if (locale === "en") return "web-en";
  if (locale === "zh-TW") return "cuv-trad";
  return DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

function localeCacheKey(): string {
  return getLocale();
}

async function loadYearDayCountChapterCached(
  bookId: string,
  chapter: number,
  translationId: string,
): Promise<LoadedChapter | null> {
  const cacheKey = `${translationId}:${bookId}:${chapter}`;
  if (yearDayCountChapterCache.has(cacheKey)) {
    return yearDayCountChapterCache.get(cacheKey) ?? null;
  }
  try {
    const loaded = await loadChapterFromBundledTranslation(bookId, chapter, translationId);
    yearDayCountChapterCache.set(cacheKey, loaded);
    return loaded;
  } catch {
    yearDayCountChapterCache.set(cacheKey, null);
    return null;
  }
}

function extractYearDayCountScriptureText(
  ref: YearDayCountScriptureRef,
  chapter: LoadedChapter,
): string | null {
  const end = ref.verseEnd ?? ref.verseStart;
  const parts = chapter.verses
    .filter((v) => v.verse >= ref.verseStart && v.verse <= end)
    .map((v) => v.text.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const locale = getLocale();
  const localizedParts = locale === "zh-TW" ? parts.map((line) => toZhTwText(line)) : parts;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return localizedParts.join(hasHan ? "" : " ");
}

async function loadYearDayCountScriptureTextsGrouped(
  refs: YearDayCountScriptureRef[],
): Promise<Record<string, string>> {
  const translationId = translationIdForLocale();
  const next: Record<string, string> = {};
  const byChapter = new Map<string, YearDayCountScriptureRef[]>();

  for (const ref of refs) {
    const key = `${ref.bookId}:${ref.chapter}`;
    const bucket = byChapter.get(key) ?? [];
    bucket.push(ref);
    byChapter.set(key, bucket);
  }

  for (const [key, chapterRefs] of byChapter) {
    const splitAt = key.indexOf(":");
    const bookId = key.slice(0, splitAt);
    const chapter = Number(key.slice(splitAt + 1));
    const loadedChapter = await loadYearDayCountChapterCached(bookId, chapter, translationId);
    for (const ref of chapterRefs) {
      next[ref.id] = loadedChapter ? extractYearDayCountScriptureText(ref, loadedChapter) ?? "" : "";
    }
  }

  return next;
}

export async function loadYearDayCountScriptureText(ref: YearDayCountScriptureRef): Promise<string | null> {
  const translationId = translationIdForLocale();
  const chapter = await loadYearDayCountChapterCached(ref.bookId, ref.chapter, translationId);
  if (!chapter) return null;
  return extractYearDayCountScriptureText(ref, chapter);
}

export function loadYearDayCountScriptureTextsProgressive(
  refs: YearDayCountScriptureRef[],
  onBatch: (partial: Record<string, string>) => void,
  options?: { batchSize?: number },
): { cancel: () => void; promise: Promise<Record<string, string>> } {
  let cancelled = false;
  const batchSize = Math.max(1, options?.batchSize ?? 6);

  const promise = (async () => {
    const all: Record<string, string> = {};
    for (let i = 0; i < refs.length; i += batchSize) {
      if (cancelled) break;
      const slice = refs.slice(i, i + batchSize);
      const batch = await loadYearDayCountScriptureTextsGrouped(slice);
      if (cancelled) break;
      Object.assign(all, batch);
      onBatch(batch);
      if (i + batchSize < refs.length) {
        await new Promise<void>((resolve) => {
          const task = InteractionManager.runAfterInteractions(() => resolve());
          if (cancelled) task.cancel();
        });
      }
    }
    return all;
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
    promise,
  };
}

export async function loadAllYearDayCountScriptureTexts(): Promise<Record<string, string>> {
  const localeKey = localeCacheKey();
  if (yearDayCountTextsPromise && yearDayCountTextsLocaleKey === localeKey) {
    return yearDayCountTextsPromise;
  }
  yearDayCountTextsLocaleKey = localeKey;
  yearDayCountTextsPromise = loadYearDayCountScriptureTextsGrouped(getYearDayCountScriptures());
  return yearDayCountTextsPromise;
}
