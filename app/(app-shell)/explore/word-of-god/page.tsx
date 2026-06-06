import { cookies, headers } from "next/headers";
import { ExploreScriptureAccordionContent } from "@/components/explore/ExploreScriptureAccordionContent";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { loadExploreRefVerseTexts } from "@/lib/explore/explore-scripture-ref";
import {
  WORD_OF_GOD_BOOK_ABBR_TO_ID,
  WORD_OF_GOD_CATEGORIES,
  WORD_OF_GOD_TITLES_EN,
} from "@/lib/explore/word-of-god-content";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("话语之光"),
  description: "按主题查看圣经如何描述神的话语：从真理、生命、引导到遵行与传扬。",
};

export default async function ExploreWordOfGodPage() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const categories = WORD_OF_GOD_CATEGORIES.map((category, index) => ({
    title: category.title,
    titleEn: WORD_OF_GOD_TITLES_EN[index],
    refs: category.refs,
  }));
  const refs = categories.flatMap((c) => c.refs);
  const verseTextByRef = await loadExploreRefVerseTexts({
    refs,
    bookAbbrMap: WORD_OF_GOD_BOOK_ABBR_TO_ID,
    locale,
  });

  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <ExploreScriptureAccordionContent
        backLabelKey="pages.explore.wordOfGodBack"
        titleKey="pages.explore.wordOfGodTitle"
        subtitleKey="pages.explore.wordOfGodSubtitle"
        categories={categories}
        bookAbbrMap={WORD_OF_GOD_BOOK_ABBR_TO_ID}
        verseTextByRef={verseTextByRef}
      />
    </ShellTemplateChromeLayout>
  );
}
