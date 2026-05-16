import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE } from "@/lib/i18n/read-scripture-about-verses";
import type { VerseDisplayModeV1 } from "@/lib/home-prayer-pools/types";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { readHomeGoldenVerseRotationStaticSync } from "@/lib/scripture/home-golden-verse-rotation-static-file";
import { readExternalHomeVerseRotationSync } from "@/lib/scripture/read-external-home-verse-rotation";
import { capSiteVersePoolRefs } from "@/lib/scripture/site-verse-pool";

/**
 * 全站唯一经文池（引用列表，最多 400）：`data/scripture/external-home-verse-rotation.json`。
 * 正文缓存：`home-golden-verse-rotation-static.json`、`public/data/home-prayer-pools/all/`。
 */
export function getHomeVerseRotationRefs(cwd: string): VerseRef[] {
  const fromFile = readExternalHomeVerseRotationSync(cwd);
  if (!fromFile?.verseRefs?.length) return [];
  return capSiteVersePoolRefs(fromFile.verseRefs);
}

const SHELL_LOCALES: AppLocale[] = ["zh-CN", "en"];

function poolOrEmergencyFallback(
  built: HomeVerseEntry[],
  locale: AppLocale,
  refsLength: number,
): HomeVerseEntry[] {
  const min = refsLength > 0 ? Math.min(4, refsLength) : 4;
  return built.length >= min ? built : [...READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE[locale]];
}

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
    result[locale] = poolOrEmergencyFallback(built, locale, refs.length);
  }
  return result;
}

/** 供生成静态快照脚本 / 管理保存后重算：全量中英轮播正文。 */
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

/** 只解析 `locales` 中的语言；池未就绪时由客户端走紧急回退文案。 */
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
      result[locale] = poolOrEmergencyFallback(built, locale, refs.length);
    }
    return result;
  }
  return buildHomeVerseRotationForLocalesResolved(cwd, locales);
}

/** 全量构建（管理脚本、需双语的测试等）；前台页面优先用 `buildHomeVerseRotationFromShellCookies`。 */
export async function buildHomeVerseRotationByLocale(cwd: string): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  return buildHomeVerseRotationForLocales(cwd, SHELL_LOCALES);
}
