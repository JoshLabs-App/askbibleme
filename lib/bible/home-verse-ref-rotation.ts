import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { HOME_VERSES_BY_LOCALE } from "@/lib/i18n/home-verses";
import type { VerseDisplayModeV1 } from "@/lib/home-prayer-pools/types";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { readHomeGoldenVerseRotationStaticSync } from "@/lib/scripture/home-golden-verse-rotation-static-file";
import { readExternalHomeVerseRotationSync } from "@/lib/scripture/read-external-home-verse-rotation";

/** 与历史 `home-verses.ts` 顺序一致；`data/scripture/external-home-verse-rotation.json` 缺失时的回退。 */
export const HOME_VERSE_ROTATION_REFS_FALLBACK: VerseRef[] = [
  { bookId: "PSA", chapter: 121, verseStart: 1, verseEnd: 2 },
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

const SHELL_LOCALES: AppLocale[] = ["zh-CN", "en"];

async function buildForLocaleFromRefs(cwd: string, locale: AppLocale, refs: VerseRef[]): Promise<HomeVerseEntry[]> {
  const out: HomeVerseEntry[] = [];
  for (const ref of refs) {
    const row = await resolveVerseRefToHomeEntry(cwd, ref, locale);
    if (row) out.push(row);
  }
  return out;
}

async function buildHomeVerseRotationForLocalesResolved(
  cwd: string,
  locales: ReadonlyArray<AppLocale>,
): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  const want = new Set<AppLocale>(locales);
  const refs = getHomeVerseRotationRefs(cwd);
  const result = {} as Record<AppLocale, HomeVerseEntry[]>;
  for (const locale of SHELL_LOCALES) {
    if (!want.has(locale)) {
      result[locale] = [];
      continue;
    }
    const built = await buildForLocaleFromRefs(cwd, locale, refs);
    result[locale] =
      built.length >= Math.min(4, refs.length) ? built : [...HOME_VERSES_BY_LOCALE[locale]];
  }
  return result;
}

/** 供生成静态快照脚本 / 管理保存后重算：全量中英轮播正文（已含「条目过少则回退内置金句」逻辑）。 */
export async function buildResolvedHomeVerseRotationSnapshot(cwd: string): Promise<{
  verseRefsCount: number;
  entriesByLocale: Record<AppLocale, HomeVerseEntry[]>;
}> {
  const refs = getHomeVerseRotationRefs(cwd);
  const entriesByLocale = await buildHomeVerseRotationForLocalesResolved(cwd, SHELL_LOCALES);
  return { verseRefsCount: refs.length, entriesByLocale };
}

/**
 * 壳层 RSC 应解析哪些语言的轮播经文。
 * - `primary`：只解析界面语言（与 `selah_locale` Cookie 一致），另一语言在 Record 中空数组，不占读盘解析。
 * - `bilingual`：中英文都解析，保证同一索引对齐（与 `selah_verse_display` Cookie 一致）。
 */
export function appLocalesForHomeVerseRotationShell(
  verseDisplay: VerseDisplayModeV1,
  uiLocale: AppLocale,
): AppLocale[] {
  if (verseDisplay === "bilingual") return [...SHELL_LOCALES];
  return [uiLocale];
}

/**
 * 只解析 `locales` 中的语言；其余键为 `[]`（客户端单语时走内置 `HOME_VERSES_BY_LOCALE` 兜底，不经 RSC 解析）。
 */
export async function buildHomeVerseRotationForLocales(
  cwd: string,
  locales: ReadonlyArray<AppLocale>,
): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  const want = new Set<AppLocale>(locales);
  const refs = getHomeVerseRotationRefs(cwd);
  const snap = readHomeGoldenVerseRotationStaticSync(cwd);
  if (snap && snap.verseRefsCount === refs.length) {
    const result = {} as Record<AppLocale, HomeVerseEntry[]>;
    for (const locale of SHELL_LOCALES) {
      if (!want.has(locale)) {
        result[locale] = [];
        continue;
      }
      const built = snap.entriesByLocale[locale] ?? [];
      result[locale] =
        built.length >= Math.min(4, refs.length) ? built : [...HOME_VERSES_BY_LOCALE[locale]];
    }
    return result;
  }
  return buildHomeVerseRotationForLocalesResolved(cwd, locales);
}

/**
 * 为首页轮播解析各语言经文；若译本缺失导致条目过少，回落到内置硬编码。
 * 全量构建（管理脚本、需双语的测试等）；前台页面优先用 `buildHomeVerseRotationFromShellCookies`。
 */
export async function buildHomeVerseRotationByLocale(cwd: string): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  return buildHomeVerseRotationForLocales(cwd, SHELL_LOCALES);
}
