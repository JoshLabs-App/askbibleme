import { cookies, headers } from "next/headers";
import {
  appLocalesForHomeVerseRotationShell,
  buildHomeVerseRotationForLocales,
} from "@/lib/bible/home-verse-ref-rotation";
import { VERSE_DISPLAY_COOKIE_NAME } from "@/lib/home-prayer-pools/constants";
import { verseDisplayModeFromCookieValue } from "@/lib/home-prayer-pools/prefs";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";

/**
 * 依请求 Cookie 只解析需要的轮播语言：单语界面不解析另一语言；双语展示时解析中英并对齐索引。
 */
export async function buildHomeVerseRotationFromShellCookies(cwd: string) {
  const jar = await cookies();
  const headerList = await headers();
  const ui = resolveRequestLocale(jar, headerList.get("accept-language"));
  const verseDisplay = verseDisplayModeFromCookieValue(jar.get(VERSE_DISPLAY_COOKIE_NAME)?.value);
  const locales = appLocalesForHomeVerseRotationShell(verseDisplay, ui);
  return await buildHomeVerseRotationForLocales(cwd, locales);
}
