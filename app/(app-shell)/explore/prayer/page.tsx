import { cookies, headers } from "next/headers";
import { ExploreScriptureAccordionContent } from "@/components/explore/ExploreScriptureAccordionContent";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { loadExploreRefVerseTexts } from "@/lib/explore/explore-scripture-ref";
import {
  PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
  PRAYER_SCRIPTURE_SCENARIOS,
} from "@/lib/explore/prayer-scripture-content";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("祷告与经文"),
  description: "按场景慢读祷告相关经文。",
};

export default async function ExplorePrayerPage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const categories = PRAYER_SCRIPTURE_SCENARIOS.map((scenario) => ({
    title: scenario.title,
    titleEn: scenario.titleEn,
    refs: scenario.refs,
  }));
  const refs = categories.flatMap((c) => c.refs);
  const verseTextByRef = await loadExploreRefVerseTexts({
    refs,
    bookAbbrMap: PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
    locale,
  });

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <ExploreScriptureAccordionContent
        backLabelKey="pages.explore.prayerScriptureBack"
        titleKey="pages.explore.prayerScriptureTitle"
        subtitleKey="pages.explore.prayerScriptureSubtitle"
        categories={categories}
        bookAbbrMap={PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID}
        verseTextByRef={verseTextByRef}
      />
    </ShellTemplateChromeLayout>
  );
}
