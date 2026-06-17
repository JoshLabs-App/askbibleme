import { cookies, headers } from "next/headers";
import { ReadBibleHomeClient } from "@/components/bible/ReadBibleHomeClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { resolveReadBibleTranslationPrefsFromCookies } from "@/lib/read/read-bible-translation-prefs";
import { loadReadHomeVerses } from "@/lib/read/read-home-verse-rotation";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./catalog/bible-catalog.css";

export const metadata = {
  title: sitePageTitle("圣经"),
  description: "正典六十六卷目录、今日读经与安静的阅读入口。",
};

export default async function ReadPlaceholderPage() {
  const cwd = process.cwd();
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const readingPlanRegistry = readReadingPlanRegistrySync(cwd)?.plans ?? [];
  const translationIndex = readTranslationsIndexSync(cwd);
  const translationPrefs = resolveReadBibleTranslationPrefsFromCookies(cookieStore, translationIndex, locale);
  const homeVerses = await loadReadHomeVerses(cwd, {
    locale,
    translationId: translationPrefs.primaryTranslationId,
  });

  return (
    <ScriptureChrome scrollHome>
      <ReadBibleHomeClient
        readingPlanRegistry={readingPlanRegistry}
        homeVerses={homeVerses}
      />
    </ScriptureChrome>
  );
}
