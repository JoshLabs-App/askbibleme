import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "../bible/types";
import { getLocale } from "../i18n/locale-store";
import { toZhTwText } from "../i18n/site-copy";
import {
  type YearDayCountScriptureRef,
  YEAR_DAY_COUNT_SCRIPTURES,
} from "./year-day-count-refs";
export {
  type YearDayCountScriptureRef,
  YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET,
  YEAR_DAY_COUNT_LEAD_REF,
  YEAR_DAY_COUNT_SCRIPTURES,
} from "./year-day-count-refs";

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

export async function loadYearDayCountScriptureText(ref: YearDayCountScriptureRef): Promise<string | null> {
  const chapter = await loadChapterFromBundledTranslation(
    ref.bookId,
    ref.chapter,
    translationIdForLocale(),
  );
  if (!chapter) return null;
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

export async function loadAllYearDayCountScriptureTexts(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    YEAR_DAY_COUNT_SCRIPTURES.map(async (ref) => {
      const text = await loadYearDayCountScriptureText(ref);
      return [ref.id, text ?? ""] as const;
    }),
  );
  return Object.fromEntries(entries);
}
