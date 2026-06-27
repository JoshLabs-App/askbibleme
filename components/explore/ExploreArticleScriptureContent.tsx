import { ExploreArticleContent } from "@/components/explore/ExploreArticleContent";
import { enrichArticleMarkdownWithScriptureContent } from "@/lib/explore/enrich-article-scripture-content";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";
import type { AppLocale } from "@/lib/i18n/config";

type Props = {
  article: ExploreFeaturedArticleView;
  locale: AppLocale;
};

export async function ExploreArticleScriptureContent({ article, locale }: Props) {
  if (article.sections.length > 0) {
    return <ExploreArticleContent article={article} />;
  }

  const enrichedBody = await enrichArticleMarkdownWithScriptureContent({
    markdown: article.body,
    locale,
  });

  return <ExploreArticleContent article={article} enrichedBody={enrichedBody} />;
}
