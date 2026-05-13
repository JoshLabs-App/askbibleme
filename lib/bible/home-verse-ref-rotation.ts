import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { HOME_VERSES_BY_LOCALE } from "@/lib/i18n/home-verses";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { readExternalHomeVerseRotationSync } from "@/lib/scripture/read-external-home-verse-rotation";

/** 与历史 `home-verses.ts` 顺序一致；`data/scripture/external-home-verse-rotation.json` 缺失时的回退。 */
export const HOME_VERSE_ROTATION_REFS_FALLBACK: VerseRef[] = [
  { bookId: "PSA", chapter: 23, verseStart: 1, verseEnd: 1 },
  { bookId: "PRO", chapter: 3, verseStart: 5, verseEnd: 5 },
  { bookId: "JHN", chapter: 3, verseStart: 16, verseEnd: 16 },
  { bookId: "PHP", chapter: 4, verseStart: 6, verseEnd: 6 },
  { bookId: "PRO", chapter: 4, verseStart: 23, verseEnd: 23 },
  { bookId: "ROM", chapter: 8, verseStart: 28, verseEnd: 28 },
  { bookId: "2CO", chapter: 5, verseStart: 7, verseEnd: 7 },
  { bookId: "PSA", chapter: 46, verseStart: 10, verseEnd: 10 },
  { bookId: "PSA", chapter: 103, verseStart: 1, verseEnd: 1 },
  { bookId: "MAT", chapter: 11, verseStart: 28, verseEnd: 28 },
];

export function getHomeVerseRotationRefs(cwd: string): VerseRef[] {
  const fromFile = readExternalHomeVerseRotationSync(cwd);
  if (fromFile?.verseRefs?.length) return fromFile.verseRefs;
  return HOME_VERSE_ROTATION_REFS_FALLBACK;
}

/** @deprecated 使用 `getHomeVerseRotationRefs(process.cwd())`；保留导出名以免外部引用断裂。 */
export const HOME_VERSE_ROTATION_REFS = HOME_VERSE_ROTATION_REFS_FALLBACK;

const LOCALES: AppLocale[] = ["zh-CN", "en"];

function buildForLocale(cwd: string, locale: AppLocale): HomeVerseEntry[] {
  const refs = getHomeVerseRotationRefs(cwd);
  const out: HomeVerseEntry[] = [];
  for (const ref of refs) {
    const row = resolveVerseRefToHomeEntry(cwd, ref, locale);
    if (row) out.push(row);
  }
  return out;
}

/**
 * 为首页轮播解析各语言经文；若译本缺失导致条目过少，回落到内置硬编码。
 */
export function buildHomeVerseRotationByLocale(cwd: string): Record<AppLocale, HomeVerseEntry[]> {
  const refs = getHomeVerseRotationRefs(cwd);
  const result = {} as Record<AppLocale, HomeVerseEntry[]>;
  for (const locale of LOCALES) {
    const built = buildForLocale(cwd, locale);
    result[locale] = built.length >= Math.min(4, refs.length) ? built : [...HOME_VERSES_BY_LOCALE[locale]];
  }
  return result;
}
