import { ExploreScriptureAccordionContent } from "@/components/explore/ExploreScriptureAccordionContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { loadExploreRefVerseTextsAllLocales } from "@/lib/explore/explore-scripture-ref";
import {
  PRAISE_WORSHIP_BOOK_ABBR_TO_ID,
  PRAISE_WORSHIP_CATEGORIES,
  PRAISE_WORSHIP_TITLES_EN,
} from "@/lib/explore/praise-worship-content";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("赞美敬拜"),
  description: "按主题慢读经文，在赞美与敬拜中定睛神。",
};

export default async function ExplorePraiseWorshipPage() {
  const categories = PRAISE_WORSHIP_CATEGORIES.map((category, index) => ({
    title: category.title,
    titleEn: PRAISE_WORSHIP_TITLES_EN[index],
    refs: category.refs,
  }));
  const refs = categories.flatMap((c) => c.refs);
  const verseTextsByLocale = await loadExploreRefVerseTextsAllLocales({
    refs,
    bookAbbrMap: PRAISE_WORSHIP_BOOK_ABBR_TO_ID,
  });

  return (
    <ExploreParchmentChrome>
      <ExploreScriptureAccordionContent
        backLabelKey="pages.explore.praiseWorshipBack"
        titleKey="pages.explore.praiseWorshipTitle"
        subtitleKey="pages.explore.praiseWorshipSubtitle"
        categories={categories}
        bookAbbrMap={PRAISE_WORSHIP_BOOK_ABBR_TO_ID}
        verseTextsByLocale={verseTextsByLocale}
      />
    </ExploreParchmentChrome>
  );
}
