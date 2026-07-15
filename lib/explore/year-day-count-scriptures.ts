import "server-only";

import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "@/lib/bible/translations-types";
import type { AppLocale } from "@/lib/i18n/config";
import {
  type YearDayCountScriptureRef,
  YEAR_DAY_COUNT_SCRIPTURES,
} from "./year-day-count-refs";
export {
  type YearDayCountScriptureRef,
  YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET,
  YEAR_DAY_COUNT_LEAD_REF,
  YEAR_DAY_COUNT_SCRIPTURES,
  formatYearDayCountRef,
} from "./year-day-count-refs";

function translationIdForLocale(locale: AppLocale): string {
  if (locale === "en") return "kjv";
  return DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

export async function loadYearDayCountScriptureText(
  ref: YearDayCountScriptureRef,
  locale: AppLocale,
): Promise<string | null> {
  const chapter = await loadChapterFromTranslation(
    process.cwd(),
    ref.bookId,
    ref.chapter,
    translationIdForLocale(locale),
  );
  if (!chapter) return null;
  const end = ref.verseEnd ?? ref.verseStart;
  const parts = chapter.verses
    .filter((v) => v.verse >= ref.verseStart && v.verse <= end)
    .map((v) => v.text.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return parts.join(hasHan ? "" : " ");
}

export async function loadAllYearDayCountScriptureTexts(locale: AppLocale): Promise<Record<string, string>> {
  const entries = await Promise.all(
    YEAR_DAY_COUNT_SCRIPTURES.map(async (ref) => {
      const text = await loadYearDayCountScriptureText(ref, locale);
      return [ref.id, text ?? ""] as const;
    }),
  );
  return Object.fromEntries(entries);
}
