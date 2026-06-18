"use client";

import Link from "next/link";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG } from "@/lib/explore/explore-featured-article-icons";
import { exploreFeaturedArticleLabel } from "@/lib/explore/explore-featured-article-labels";
import { exploreArticleHref, isExploreFeaturedArticleSlug } from "@/lib/explore/explore-featured-article-slugs";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";

type Props = {
  articles: ExploreFeaturedArticleView[];
};

export function ExploreFeaturedArticlesCard({ articles }: Props) {
  const { locale } = useLocale();

  if (!articles.length) return null;

  return (
    <>
      <div className="explore-icon-grid">
        {articles.map((article) => {
          const icon = isExploreFeaturedArticleSlug(article.slug)
            ? EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG[article.slug]
            : "file-document-outline";

          return (
            <Link
              key={article.slug}
              href={exploreArticleHref(article.slug)}
              className="explore-icon-tile"
            >
              <span aria-hidden className="explore-icon-circle">
                <ShellMaterialCommunityIcon name={icon} size={28} />
              </span>
              <span className="explore-icon-label">
                {exploreFeaturedArticleLabel(article.slug, locale) ?? article.exploreLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
