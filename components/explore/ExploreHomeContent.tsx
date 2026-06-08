"use client";

import Link from "next/link";
import { EXPLORE_ENTRIES, SCRIPTURE_ANTHOLOGY_IDS } from "@/lib/explore/exploreEntries";
import { ExploreFeaturedArticlesCard } from "@/components/explore/ExploreFeaturedArticlesCard";
import { ExploreEntryIcon } from "@/components/explore/ExploreEntryIcon";
import { useLocale } from "@/components/i18n/LocaleProvider";
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

  const anthologyHeading =
    locale === "en" ? "Scripture Anthology" : locale === "zh-TW" ? "經文彙編" : "经文汇编";

  const renderEntryTile = (entry: (typeof EXPLORE_ENTRIES)[number]) => (
    <Link key={entry.id} href={entry.href} className="explore-icon-tile">
      <span aria-hidden className="explore-icon-circle">
        <ExploreEntryIcon entry={entry} size={28} />
      </span>
      <span className="explore-icon-label">{t(entry.labelKey)}</span>
    </Link>
  );

  return (
    <div className="explore-home">
      <header className="explore-home-header">
        <h1 className="explore-home-title">{t("pages.explore.title")}</h1>
        <div className="explore-home-rule" aria-hidden />
        <p className="explore-home-lead">{t("pages.explore.lead")}</p>
      </header>

      <section className="explore-page-section">
        <div className="explore-icon-grid">{topEntries.map(renderEntryTile)}</div>

        <div className="explore-section-divider" aria-hidden />

        <p className="explore-section-label">{anthologyHeading}</p>

        <div className="explore-icon-grid">{scriptureAnthologyEntries.map(renderEntryTile)}</div>

        <ExploreFeaturedArticlesCard articles={featuredArticles} />
      </section>
    </div>
  );
}
