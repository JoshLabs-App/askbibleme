import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { buildHomeVerseRotationForLocales } from "@/lib/bible/home-verse-ref-rotation";
import { READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE } from "@/lib/i18n/read-scripture-about-verses";

const LOCALES: AppLocale[] = ["zh-CN", "en"];

function rotationUsable(by: Record<AppLocale, HomeVerseEntry[]>): boolean {
  for (const locale of LOCALES) {
    if ((by[locale] ?? []).length < 4) return false;
  }
  return true;
}

/**
 * `/read` 圣经首页等独立轮播：与全站同源（`theme-repeat-ge5` 静态池 bootstrap）。
 * 解析过少时回退 `READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE`。
 */
export async function buildReadBibleHomeStandaloneVersesByLocale(
  cwd: string,
): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  const built = await buildHomeVerseRotationForLocales(cwd, LOCALES);
  return rotationUsable(built) ? built : READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE;
}
