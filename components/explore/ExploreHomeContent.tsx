"use client";

import Link from "next/link";
import { EXPLORE_ENTRIES, SCRIPTURE_ANTHOLOGY_IDS } from "@/lib/explore/exploreEntries";
import { ExploreAppInstallHint } from "@/components/explore/ExploreAppInstallHint";
import { ExploreEntryIcon } from "@/components/explore/ExploreEntryIcon";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG } from "@/lib/explore/explore-featured-article-icons";
import { exploreFeaturedArticleLabel } from "@/lib/explore/explore-featured-article-labels";
import { exploreArticleHref, isExploreFeaturedArticleSlug } from "@/lib/explore/explore-featured-article-slugs";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";

type Props = {
  featuredArticles: ExploreFeaturedArticleView[];
};

export function ExploreHomeContent({ featuredArticles }: Props) {
  const { t, locale } = useLocale();

  const scriptureAnthologyEntries = SCRIPTURE_ANTHOLOGY_IDS.map((id) =>
    EXPLORE_ENTRIES.find((entry) => entry.id === id),
  ).filter((entry): entry is (typeof EXPLORE_ENTRIES)[number] => Boolean(entry));

  const topEntries = EXPLORE_ENTRIES.filter(
    (entry) => !SCRIPTURE_ANTHOLOGY_IDS.includes(entry.id as (typeof SCRIPTURE_ANTHOLOGY_IDS)[number]),
  );

  const renderEntryTile = (entry: (typeof EXPLORE_ENTRIES)[number]) => (
    <Link key={entry.id} href={entry.href} className="explore-icon-tile">
      <span aria-hidden className="explore-icon-circle">
        <ExploreEntryIcon entry={entry} size={28} />
      </span>
      <span className="explore-icon-label">{t(entry.labelKey)}</span>
    </Link>
  );

  const renderFeaturedArticleTile = (article: ExploreFeaturedArticleView) => {
    const icon = isExploreFeaturedArticleSlug(article.slug)
      ? EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG[article.slug]
      : "file-document-outline";

    return (
      <Link key={article.slug} href={exploreArticleHref(article.slug)} className="explore-icon-tile">
        <span aria-hidden className="explore-icon-circle">
          <ShellMaterialCommunityIcon name={icon} size={28} />
        </span>
        <span className="explore-icon-label">
          {exploreFeaturedArticleLabel(article.slug, locale) ?? article.exploreLabel}
        </span>
      </Link>
    );
  };

  return (
    <div className="explore-home">
      <header className="explore-home-header">
        <h1 className="explore-home-title">{t("pages.explore.title")}</h1>
        <div className="explore-home-rule" aria-hidden />
        <p className="explore-home-lead">{t("pages.explore.lead")}</p>
      </header>

      <section className="explore-page-section">
        <div className="explore-icon-grid">
          {topEntries.map(renderEntryTile)}
          {scriptureAnthologyEntries.map(renderEntryTile)}
          {featuredArticles.map(renderFeaturedArticleTile)}
        </div>

        <ExploreAppInstallHint />
      </section>
    </div>
  );
}
