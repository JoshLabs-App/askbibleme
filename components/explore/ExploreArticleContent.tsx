"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExploreFeaturedArticleSections } from "@/components/explore/ExploreFeaturedArticleSections";
import { LegacyArticleMarkdown } from "@/components/legacy/LegacyArticleMarkdown";
import { ContentCorrectionEntry } from "@/components/content-correction/ContentCorrectionEntry";
import { ExploreProsePage } from "@/components/explore/ExploreProsePage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { exploreFeaturedArticleUsesProseLayout } from "@/lib/explore/explore-featured-article-slugs";
import {
  readExploreFeaturedArticleView,
  type ExploreFeaturedArticleView,
} from "@/lib/explore/read-explore-featured-article-localized";

type Props = {
  article: ExploreFeaturedArticleView;
  enrichedBody?: string;
};

export function ExploreArticleContent({ article: initialArticle, enrichedBody }: Props) {
  const { t, locale } = useLocale();
  const article = useMemo(
    () => readExploreFeaturedArticleView(initialArticle.slug, locale) ?? initialArticle,
    [initialArticle, locale],
  );
  const body = enrichedBody ?? article.body;

  return (
    <ExploreProsePage>
      <Link href="/explore" className="explore-prose-back underline">
        {t("pages.explore.articlesBack")}
      </Link>

      <header className="explore-prose-header">
        <h1 className="explore-prose-title">{article.title}</h1>
      </header>

      <article className="explore-prose-body">
        {article.sections.length > 0 && !exploreFeaturedArticleUsesProseLayout(article.slug) ? (
          <ExploreFeaturedArticleSections sections={article.sections} />
        ) : (
          <LegacyArticleMarkdown content={body} linkScriptureRefs variant="explore" />
        )}
        <ContentCorrectionEntry
          context={{
            scope: "explore_article",
            articleSlug: article.slug,
            articleTitle: article.title,
          }}
        />
      </article>
    </ExploreProsePage>
  );
}
