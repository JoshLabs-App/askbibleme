import { cookies, headers } from "next/headers";
import { ExploreScriptureAccordionContent } from "@/components/explore/ExploreScriptureAccordionContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { loadExploreRefVerseTexts } from "@/lib/explore/explore-scripture-ref";
import {
  NARROW_GATE_BOOK_ABBR_TO_ID,
  NARROW_GATE_CATEGORIES,
  NARROW_GATE_TITLES_EN,
} from "@/lib/explore/narrow-gate-content";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("窄门之路"),
  description: "沿着主耶稣指出的窄路，按主题慢读经文。",
};

export default async function ExploreNarrowGatePage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const categories = NARROW_GATE_CATEGORIES.map((category, index) => ({
    title: category.title,
    titleEn: NARROW_GATE_TITLES_EN[index],
    refs: category.refs,
  }));
  const refs = categories.flatMap((c) => c.refs);
  const verseTextByRef = await loadExploreRefVerseTexts({
    refs,
    bookAbbrMap: NARROW_GATE_BOOK_ABBR_TO_ID,
    locale,
  });

  return (
    <ExploreParchmentChrome proseScroll>
      <ExploreScriptureAccordionContent
        backLabelKey="pages.explore.narrowGateBack"
        titleKey="pages.explore.narrowGateTitle"
        subtitleKey="pages.explore.narrowGateSubtitle"
        categories={categories}
        bookAbbrMap={NARROW_GATE_BOOK_ABBR_TO_ID}
        verseTextByRef={verseTextByRef}
      />
    </ExploreParchmentChrome>
  );
}
