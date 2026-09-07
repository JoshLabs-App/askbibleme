import { ExploreScriptureAccordionContent } from "@/components/explore/ExploreScriptureAccordionContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { loadExploreRefVerseTextsAllLocales } from "@/lib/explore/explore-scripture-ref";
import {
  PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
  PRAYER_SCRIPTURE_SCENARIOS,
} from "@/lib/explore/prayer-scripture-content";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("祷告与经文"),
  description: "按场景慢读祷告相关经文。",
};

export default async function ExplorePrayerPage() {
  const categories = PRAYER_SCRIPTURE_SCENARIOS.map((scenario) => ({
    title: scenario.title,
    titleTw: scenario.titleTw,
    titleEn: scenario.titleEn,
    refs: scenario.refs,
  }));
  const refs = categories.flatMap((c) => c.refs);
  const verseTextsByLocale = await loadExploreRefVerseTextsAllLocales({
    refs,
    bookAbbrMap: PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
  });

  return (
    <ExploreParchmentChrome>
      <ExploreScriptureAccordionContent
        backLabelKey="pages.explore.prayerScriptureBack"
        titleKey="pages.explore.prayerScriptureTitle"
        subtitleKey="pages.explore.prayerScriptureSubtitle"
        categories={categories}
        bookAbbrMap={PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID}
        verseTextsByLocale={verseTextsByLocale}
      />
    </ExploreParchmentChrome>
  );
}
