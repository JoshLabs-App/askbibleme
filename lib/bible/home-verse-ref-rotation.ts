import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE } from "@/lib/i18n/read-scripture-about-verses";
import type { VerseDisplayModeV1 } from "@/lib/home-prayer-pools/types";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { readThemeRepeatPoolFallbackSync } from "@/lib/home-prayer-pools/read-theme-repeat-pool-fallback-sync";
import { readExternalHomeVerseRotationSync } from "@/lib/scripture/read-external-home-verse-rotation";
import { capSiteVersePoolRefs } from "@/lib/scripture/site-verse-pool";
import { DEFAULT_THEME_REPEAT_MIN_COUNT } from "@/lib/scripture/theme-repeat-pool-scope-id";

const SHELL_LOCALES: AppLocale[] = ["zh-CN", "en"];

function poolOrEmergencyFallback(
  built: HomeVerseEntry[],
  locale: AppLocale,
  refsLength: number,
): HomeVerseEntry[] {
  const min = refsLength > 0 ? Math.min(4, refsLength) : 4;
  return built.length >= min ? built : [...READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE[locale]];
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

/** 只解析 `locales` 中的语言；正文来自 `theme-repeat-ge{N}` 静态池 bootstrap。 */
export async function buildHomeVerseRotationForLocales(
  cwd: string,
  locales: ReadonlyArray<AppLocale>,
  minCount: number = DEFAULT_THEME_REPEAT_MIN_COUNT,
): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  const want = new Set<AppLocale>(locales);
  const fromPool = readThemeRepeatPoolFallbackSync(cwd, locales, minCount);
  const result = {} as Record<AppLocale, HomeVerseEntry[]>;
  for (const locale of SHELL_LOCALES) {
    if (!want.has(locale)) {
      result[locale] = [];
      continue;
    }
    const built = fromPool[locale] ?? [];
    result[locale] = poolOrEmergencyFallback(built, locale, built.length);
  }
  return result;
}

/** 全量构建（测试等）；前台页面优先用 `buildHomeVerseRotationFromShellCookies`。 */
export async function buildHomeVerseRotationByLocale(cwd: string): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  return buildHomeVerseRotationForLocales(cwd, SHELL_LOCALES);
}

/** @deprecated 仅 Admin 策展金句 / 旧脚本；前台轮播已改用主题库 `theme-repeat-ge{N}`。 */
export function getHomeVerseRotationRefs(cwd: string): VerseRef[] {
  const fromFile = readExternalHomeVerseRotationSync(cwd);
  if (!fromFile?.verseRefs?.length) return [];
  return capSiteVersePoolRefs(fromFile.verseRefs);
}

async function buildForLocaleFromRefs(cwd: string, locale: AppLocale, refs: VerseRef[]): Promise<HomeVerseEntry[]> {
  const out: HomeVerseEntry[] = [];
  for (const ref of refs) {
    const row = await resolveVerseRefToHomeEntry(cwd, ref, locale);
    if (row) out.push(row);
  }
  return out;
}

/** @deprecated 供 `generate-home-golden-verse-rotation-static` 等管理脚本。 */
export async function buildResolvedHomeVerseRotationSnapshot(cwd: string): Promise<{
  verseRefsCount: number;
  entriesByLocale: Record<AppLocale, HomeVerseEntry[]>;
}> {
  const refs = getHomeVerseRotationRefs(cwd);
  const entriesByLocale = {} as Record<AppLocale, HomeVerseEntry[]>;
  for (const locale of SHELL_LOCALES) {
    const built = await buildForLocaleFromRefs(cwd, locale, refs);
    entriesByLocale[locale] = poolOrEmergencyFallback(built, locale, refs.length);
  }
  return { verseRefsCount: refs.length, entriesByLocale };
}
